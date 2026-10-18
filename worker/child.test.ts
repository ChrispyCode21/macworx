import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { generateAssignment } from '../src/engine'
import { createTestDb, migrationStatements, OTHER_KEY } from './test/db'

let t: Awaited<ReturnType<typeof createTestDb>>
beforeEach(async () => {
  t = await createTestDb()
})
afterEach(async () => {
  await t.dispose()
})

const at = (day: string) => new Date(`${day}T12:00:00Z`)

/** Gets one seed handed out on `day`. */
async function seed(day = '2026-10-17'): Promise<number> {
  const { body } = await t.call('POST', '/api/seeds', { now: at(day) })
  // Use the seeds in a fixed order so a test can take several.
  return body.seeds.find((s: number) => !used.has(s) && used.add(s))
}
const used = new Set<number>()
beforeEach(() => used.clear())

/** Answers for a seed: `correct` right, the rest off by one; `count` answers in all. */
function answers(seedValue: number, correct = 20, count = 20): number[] {
  return generateAssignment(seedValue)
    .slice(0, count)
    .map((p, i) => (i < correct ? p.answer : p.answer + 1))
}

async function finish(day: string, opts: { correct?: number; now?: string; count?: number } = {}) {
  const s = await seed(opts.now ?? day)
  return t.call('POST', '/api/results', {
    body: { seed: s, day, answers: answers(s, opts.correct ?? 20, opts.count ?? 20) },
    now: at(opts.now ?? day),
  })
}

describe('migration', () => {
  it('applies to an empty database and creates the one child row', async () => {
    expect(migrationStatements().length).toBeGreaterThan(0)
    const child = await t.db.prepare('SELECT * FROM child').all()
    expect(child.results).toEqual([
      { id: 1, balance: 0, streak: 0, last_day: null, completed: 0, revision: '' },
    ])
  })

  it('allows only one child row', async () => {
    await expect(t.db.prepare('INSERT INTO child (id) VALUES (2)').run()).rejects.toThrow()
  })
})

describe('saving results (SPEC §6.8)', () => {
  it('W1: a finished result, 20 correct → recorded, payout 25, balance 25, streak 1, Excellent', async () => {
    const s = await seed()
    const { status, body } = await t.call('POST', '/api/results', {
      body: { seed: s, day: '2026-10-17', answers: answers(s) },
    })
    expect(status).toBe(201)
    expect(body.result).toMatchObject({
      seed: s,
      day: '2026-10-17',
      answered: 20,
      correct: 20,
      finished: true,
      grade: 'Excellent',
      payout: { base: 20, accuracyBonus: 4, streakBonus: 1, total: 25 },
    })
    expect(body.state).toMatchObject({
      balance: 25,
      streak: 1,
      lastDay: '2026-10-17',
      completed: 1,
      latestGrade: 'Excellent',
    })
    const row = await t.db.prepare('SELECT used FROM seeds WHERE seed = ?').bind(s).first<{ used: number }>()
    expect(row?.used).toBe(1)
  })

  it('W2: the same seed sent again → the recorded result, nothing counted twice', async () => {
    const s = await seed()
    const request = { body: { seed: s, day: '2026-10-17', answers: answers(s) } }
    await t.call('POST', '/api/results', request)
    const again = await t.call('POST', '/api/results', request)
    expect(again.status).toBe(200)
    expect(again.body.result.payout.total).toBe(25)
    expect(again.body.state).toMatchObject({ balance: 25, completed: 1 })
  })

  it('W3: a day two days after the Worker date → recorded on the Worker tomorrow', async () => {
    const { body } = await finish('2026-10-19', { now: '2026-10-17' })
    expect(body.result.day).toBe('2026-10-18')
  })

  it('W4: no key, or a key that is not valid → 401, nothing recorded', async () => {
    const s = await seed()
    for (const key of [null, 'not-a-real-device-key-at-all-0000']) {
      const { status } = await t.call('POST', '/api/results', {
        body: { seed: s, day: '2026-10-17', answers: answers(s) },
        key,
      })
      expect(status).toBe(401)
    }
    expect((await t.call('GET', '/api/state')).body).toMatchObject({ balance: 0, completed: 0 })
  })

  it('W5: a result dated before her last counted day counts as that day: streak unchanged, still paid', async () => {
    await t.db.prepare("UPDATE child SET streak = 4, last_day = '2026-10-17'").run()
    // Handed out on 10-14, so 10-15 is in range and stays 10-15: two days before her last counted day,
    // which without the §6.8 rule would restart the streak (S8) and move her last day backwards.
    const s = await seed('2026-10-14')
    const { body } = await t.call('POST', '/api/results', {
      body: { seed: s, day: '2026-10-15', answers: answers(s) },
      now: at('2026-10-17'),
    })
    expect(body.result.day).toBe('2026-10-15')
    expect(body.result.payout).toEqual({ base: 20, accuracyBonus: 4, streakBonus: 0, total: 24 })
    expect(body.state).toMatchObject({ streak: 4, lastDay: '2026-10-17', balance: 24 })
  })

  it('W6: left early, 8 answered, 7 correct → paid 7; streak, last day and completed unchanged; no grade', async () => {
    await t.db.prepare("UPDATE child SET streak = 3, last_day = '2026-10-16'").run()
    const { status, body } = await finish('2026-10-17', { correct: 7, count: 8 })
    expect(status).toBe(201)
    expect(body.result).toMatchObject({ answered: 8, correct: 7, finished: false, grade: null })
    expect(body.result.payout.total).toBe(7)
    expect(body.state).toMatchObject({
      balance: 7,
      streak: 3,
      lastDay: '2026-10-16',
      completed: 0,
      latestGrade: null,
    })
  })

  it('reproduces the streak examples day by day (S1, S2, S5, S6 and P4 = 31)', async () => {
    const days = [
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
    ]
    let last
    for (const day of days) last = await finish(day)
    expect(last!.body.result.payout.total).toBe(31) // P4: 20 + 4 + 7-day streak
    expect(last!.body.state.streak).toBe(7)

    const second = await finish('2026-10-17') // S5: same day, no streak bonus
    expect(second.body.result.payout.streakBonus).toBe(0)

    const afterGap = await finish('2026-10-20') // S6: a gap starts over
    expect(afterGap.body.state.streak).toBe(1)
  })

  it('records a concurrent repeat of the same seed only once', async () => {
    const s = await seed()
    const request = { body: { seed: s, day: '2026-10-17', answers: answers(s) } }
    const results = await Promise.all([
      t.call('POST', '/api/results', request),
      t.call('POST', '/api/results', request),
    ])
    expect(results.map((r) => r.body.result.payout.total)).toEqual([25, 25])
    expect((await t.call('GET', '/api/state')).body).toMatchObject({ balance: 25, completed: 1 })
  })

  it('refuses a seed that was never handed out, or was handed to another device', async () => {
    const unknown = await t.call('POST', '/api/results', {
      body: { seed: 12345, day: '2026-10-17', answers: [1] },
    })
    expect(unknown.status).toBe(404)
    const s = await seed()
    const theirs = await t.call('POST', '/api/results', {
      body: { seed: s, day: '2026-10-17', answers: answers(s) },
      key: OTHER_KEY,
    })
    expect(theirs.status).toBe(404)
  })

  it('refuses bodies that are not a result', async () => {
    const s = await seed()
    for (const body of [
      undefined,
      { seed: s, day: '2026-10-17', answers: [] },
      { seed: s, day: '2026-10-17', answers: new Array(21).fill(1) },
      { seed: s, day: '2026-10-17', answers: [1.5] },
      { seed: s, day: '2026-10-17', answers: [-1] },
      { seed: s, day: '17/10/2026', answers: [1] },
      { seed: -1, day: '2026-10-17', answers: [1] },
      { seed: '7', day: '2026-10-17', answers: [1] },
    ]) {
      const { status } = await t.call('POST', '/api/results', { body })
      expect(status, JSON.stringify(body)).toBe(400)
    }
  })

  it('moves a day too early into range: no earlier than the day before the seed was handed out', async () => {
    const { body } = await finish('2026-10-01', { now: '2026-10-17' })
    expect(body.result.day).toBe('2026-10-16')
  })
})

describe('seeds', () => {
  it('tops a device up to 20 unused seeds and never hands out a used one again', async () => {
    const first = await t.call('POST', '/api/seeds')
    expect(first.body.seeds).toHaveLength(20)
    const s = first.body.seeds[0]
    await t.call('POST', '/api/results', { body: { seed: s, day: '2026-10-17', answers: answers(s) } })
    const second = await t.call('POST', '/api/seeds')
    expect(second.body.seeds).toHaveLength(20)
    expect(second.body.seeds).not.toContain(s)
  })

  it('keeps each device to 20, even with requests at once', async () => {
    await Promise.all([t.call('POST', '/api/seeds'), t.call('POST', '/api/seeds')])
    const count = await t.db.prepare('SELECT COUNT(*) AS n FROM seeds WHERE used = 0').first<{ n: number }>()
    expect(count?.n).toBe(20)
  })
})

describe('state', () => {
  it('lists which pending seeds are already recorded', async () => {
    const s = await seed()
    await t.call('POST', '/api/results', { body: { seed: s, day: '2026-10-17', answers: answers(s) } })
    const { body } = await t.call('GET', `/api/state?pending=${s},42`)
    expect(body.applied).toEqual([s])
  })

  it('refuses a pending list that is too long or not seeds', async () => {
    const tooMany = Array.from({ length: 101 }, (_, i) => i).join(',')
    expect((await t.call('GET', `/api/state?pending=${tooMany}`)).status).toBe(400)
    expect((await t.call('GET', '/api/state?pending=1,x')).status).toBe(400)
  })

  it('latest grade skips assignments she left early', async () => {
    await finish('2026-10-17', { correct: 16 })
    await finish('2026-10-17', { correct: 3, count: 5 })
    expect((await t.call('GET', '/api/state')).body.latestGrade).toBe('Good')
  })
})

describe('every child route needs a device key', () => {
  it.each([
    ['GET', '/api/state'],
    ['POST', '/api/seeds'],
    ['POST', '/api/results'],
  ])('%s %s → 401 without one, or with a revoked one', async (method, path) => {
    expect((await t.call(method, path, { key: null })).status).toBe(401)
    await t.db.prepare("UPDATE devices SET revoked_at = '2026-10-17'").run()
    expect((await t.call(method, path)).status).toBe(401)
  })
})

describe('review fixes', () => {
  it('answers a pending list of exactly 100 seeds', async () => {
    const hundred = Array.from({ length: 100 }, (_, i) => i).join(',')
    expect((await t.call('GET', `/api/state?pending=${hundred}`)).status).toBe(200)
  })

  it('never records or pays a seed twice, even if the result row already exists', async () => {
    const s = await seed()
    const request = { body: { seed: s, day: '2026-10-17', answers: answers(s) } }
    await t.call('POST', '/api/results', request)
    await t.db.prepare("UPDATE child SET revision = 'reset'").run()
    const again = await t.call('POST', '/api/results', request)
    expect(again.status).toBe(200)
    expect(again.body.state).toMatchObject({ balance: 25, completed: 1 })
  })
})
