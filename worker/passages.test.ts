// Adding a passage from the parent portal (SPEC §6.10, §7.L): the second look at what the portal checked.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PASSAGE_LIMITS } from '../src/engine'
import { postPassage } from './passages'
import { clearAccessKeys } from './access'
import { accessToken } from './test/access-keys'
import { createTestDb } from './test/db'

let t: Awaited<ReturnType<typeof createTestDb>>
let token: string
beforeEach(async () => {
  clearAccessKeys()
  t = await createTestDb()
  token = await accessToken()
})
afterEach(async () => {
  await t.dispose()
})

const post = (body: unknown) =>
  t.call('POST', '/api/parent/passages', { key: null, accessToken: token, body })
const save = (passage: unknown) => post({ passage })
const count = async (sql: string) => (await t.db.prepare(sql).first<{ n: number }>())!.n

const question = (n: number, over: Record<string, unknown> = {}) => ({
  question: `Question ${n}?`,
  options: [`a${n}`, `b${n}`, `c${n}`, `d${n}`],
  correct_answer: `b${n}`,
  explanation: `Because ${n}.`,
  ...over,
})
const passage = (n = 3, over: Record<string, unknown> = {}) => ({
  title: 'The Little Seed',
  minutes: 2,
  topic: 'Story',
  passage: ['Mia plants a seed.', 'She waters it.'],
  questions: Array.from({ length: n }, (_, i) => question(i + 1)),
  ...over,
})
const nothingSaved = async () => {
  expect(await count('SELECT COUNT(*) AS n FROM passages')).toBe(0)
  expect(await count('SELECT COUNT(*) AS n FROM questions')).toBe(0)
  expect(await count('SELECT COUNT(*) AS n FROM choices')).toBe(0)
}

describe('POST /api/parent/passages', () => {
  it('L18: a valid passage is saved whole and handed out like any passage', async () => {
    const { status, body } = await save(passage(3))
    expect([status, body.id]).toEqual([201, 1])
    expect(await count('SELECT COUNT(*) AS n FROM questions')).toBe(3)
    expect(await count('SELECT COUNT(*) AS n FROM choices')).toBe(12)
    const stored = await t.db.prepare('SELECT * FROM passages WHERE id = 1').first<Record<string, any>>()
    expect(stored).toMatchObject({ title: 'The Little Seed', genre: 'Story', minutes: 2, image: null })
    expect(stored!.body).toBe('Mia plants a seed.\n\nShe waters it.')

    const started = await t.call('POST', '/api/reading/start', { now: new Date('2026-10-17T12:00:00Z') })
    expect(started.body.passage).toMatchObject({ id: 1, title: 'The Little Seed', genre: 'Story' })
    expect(started.body.passage.questions).toHaveLength(3)
  })

  it('L18: the next passage takes the next free id, and a 50-question passage saves', async () => {
    expect((await save(passage(2))).body.id).toBe(1)
    const big = await save(passage(PASSAGE_LIMITS.questions))
    expect([big.status, big.body.id]).toEqual([201, 2])
    expect(await count('SELECT COUNT(*) AS n FROM choices WHERE question_id BETWEEN 201 AND 250')).toBe(200)
  })

  it("never gives a deleted passage's id to a new one", async () => {
    expect((await save(passage(1))).body.id).toBe(1)
    expect((await save(passage(1))).body.id).toBe(2)
    await t.db.prepare('DELETE FROM choices WHERE question_id BETWEEN 201 AND 299').run()
    await t.db.prepare('DELETE FROM questions WHERE passage_id = 2').run()
    await t.db.prepare('DELETE FROM passages WHERE id = 2').run()
    // With nothing remembered, the highest left (1) would give id 2 again.
    await t.db.prepare("INSERT INTO id_floor (name, value) VALUES ('passages', 2)").run()
    expect((await save(passage(1))).body.id).toBe(3)
  })

  it('L20: keeps the pasted object and shuffles choices once, with exactly one right', async () => {
    const pasted = passage(5, { settings: { shuffle_options: true, points_per_question: 5 }, grade: 2 })
    await save(pasted)
    const row = await t.db.prepare('SELECT source FROM passages WHERE id = 1').first<{ source: string }>()
    expect(JSON.parse(row!.source)).toEqual(pasted)
    const rows = (await t.db.prepare('SELECT question_id, text, correct FROM choices').all<any>()).results
    for (let q = 1; q <= 5; q++) {
      const of = rows.filter((r) => r.question_id === 100 + q)
      expect(of.map((r) => r.text).sort()).toEqual([`a${q}`, `b${q}`, `c${q}`, `d${q}`])
      expect(of.filter((r) => r.correct === 1).map((r) => r.text)).toEqual([`b${q}`])
    }
  })

  it('L19: refuses a passage that fails the checks with the problems, and saves nothing', async () => {
    const bad = passage(2, { questions: [question(1), question(2, { options: ['a', 'b', 'c'] })] })
    const { status, body } = await save(bad)
    expect(status).toBe(400)
    expect(body).toEqual({
      error: 'bad_passage',
      problems: ['Question 2 needs exactly 4 "options" (it has 3).'],
    })
    await nothingSaved()
  })

  it('L19: refuses a body with no passage, and a passage over 64 KB', async () => {
    expect((await post({ nope: 1 })).status).toBe(400)
    expect((await post('text')).status).toBe(400)
    const big = await save(passage(1, { pad: 'x'.repeat(PASSAGE_LIMITS.bytes) }))
    expect([big.status, big.body.error]).toEqual([400, 'bad_passage'])
    await nothingSaved()
  })

  /** The Worker's database with a hook on its statements, to stage a clash or a fault. */
  const withDb = (hook: (sql: string) => unknown) => {
    const real = t.db
    return new Proxy(real, {
      get: (target, prop) => {
        if (prop === 'prepare')
          return (sql: string) => {
            const made = hook(sql)
            return made ?? target.prepare(sql)
          }
        const value = (target as any)[prop]
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
  }
  const request = (db: D1Database, body: string = JSON.stringify({ passage: passage(2) })) =>
    ({
      request: new Request('https://x/api/parent/passages', {
        method: 'POST',
        body,
      }),
      url: new URL('https://x/api/parent/passages'),
      db,
      email: 'p@example.com',
      now: new Date('2026-10-17T12:00:00Z'),
      params: {},
    }) as Parameters<typeof postPassage>[0]

  it('retries with a fresh id when another save took the one it read', async () => {
    await save(passage(2)) // takes id 1
    let stale = true
    const db = withDb((sql) => {
      if (!sql.startsWith('SELECT COALESCE(MAX(id)') || !stale) return null
      stale = false
      return { first: async () => ({ id: 1 }) } // what it read before the other save landed
    })
    const response = await postPassage(request(db))
    expect([response.status, ((await response.json()) as { id: number }).id]).toEqual([201, 2])
    expect(await count('SELECT COUNT(*) AS n FROM passages')).toBe(2)
  })

  it('a fault that is not an id clash is thrown, not retried as busy', async () => {
    const db = withDb((sql) => {
      if (!sql.startsWith('INSERT INTO passages')) return null
      return { bind: () => ({}) }
    })
    const broken = new Proxy(db, {
      get: (target, prop) =>
        prop === 'batch'
          ? async () => {
              throw new Error('D1_ERROR: boom')
            }
          : (target as any)[prop],
    })
    await expect(postPassage(request(broken))).rejects.toThrow('boom')
    await nothingSaved()
  })

  it('L19: the size limit counts the passage compact, so a request indented far more is still accepted', async () => {
    const padded = passage(1, { pad: Array.from({ length: 12000 }, () => 1) })
    const body = JSON.stringify({ passage: padded }, null, 10)
    expect(body.length).toBeGreaterThan(PASSAGE_LIMITS.bytes * 2)
    expect((await postPassage(request(t.db, body))).status).toBe(201)
  })

  it('needs an Access token like every parent route', async () => {
    const { status } = await t.call('POST', '/api/parent/passages', {
      key: null,
      body: { passage: passage() },
    })
    expect(status).toBe(401)
    await nothingSaved()
  })
})

// The list, edit and delete of saved passages (SPEC §5.3, §6.10, L21, L22).
describe('saved passages', () => {
  const as = (method: string, path: string, body?: unknown) =>
    t.call(method, path, { key: null, accessToken: token, body })
  const run = (sql: string, ...values: unknown[]) =>
    t.db
      .prepare(sql)
      .bind(...values)
      .run()
  const one = (sql: string, ...values: unknown[]) =>
    t.db
      .prepare(sql)
      .bind(...values)
      .first<any>()
  const start = () => t.call('POST', '/api/reading/start', { now: new Date('2026-10-17T12:00:00Z') })

  /** A result recorded straight into the database for a new attempt at passage `id`. */
  async function recorded(id: number, finished = 1) {
    const made = await run(
      "INSERT INTO reading_attempts (device_id, child_id, passage_id, issued_day, used) VALUES (1, 1, ?, '2026-10-01', 1)",
      id,
    )
    await run(
      `INSERT INTO results (kind, attempt, detail, device_id, child_id, day, answers, answered, correct, finished, grade, base,
       accuracy_bonus, streak_bonus, total, created_at) VALUES ('reading', ?, '{}', 1, 1, '2026-10-01', '[]', 3, 3, ?, 'Excellent', 20, 4, 0, 24, 'x')`,
      made.meta.last_row_id,
      finished,
    )
  }

  /** A fake bucket that remembers what was deleted. */
  function bucket() {
    const deleted: string[] = []
    t.env.PASSAGE_IMAGES = {
      async delete(key: string) {
        deleted.push(key)
      },
    } as unknown as R2Bucket
    return deleted
  }

  it('lists each passage with its questions and the number of finished results', async () => {
    await save(passage(3))
    await save(passage(5, { title: 'Second' }))
    await recorded(1)
    await recorded(1)
    await recorded(1, 0) // left early: not a time read
    const { status, body } = await as('GET', '/api/parent/passages')
    expect(status).toBe(200)
    expect(body.passages).toEqual([
      { id: 1, title: 'The Little Seed', minutes: 2, questions: 3, timesRead: 2 },
      { id: 2, title: 'Second', minutes: 2, questions: 5, timesRead: 0 },
    ])
  })

  it('gives back the JSON as it was pasted, with the fields that do nothing', async () => {
    const pasted = passage(2, { settings: { shuffle_options: true }, reading_level: 'A' })
    await save(pasted)
    const { body } = await as('GET', '/api/parent/passages/1')
    expect(body.passage).toEqual(pasted)
  })

  it('rebuilds the JSON of a passage added by hand, and 404s for one that is not there', async () => {
    await save(passage(2))
    await run('UPDATE passages SET source = NULL WHERE id = 1')
    const { body } = await as('GET', '/api/parent/passages/1')
    expect(body.passage).toMatchObject({ title: 'The Little Seed', minutes: 2, topic: 'Story' })
    expect(body.passage.passage).toEqual(['Mia plants a seed.', 'She waters it.'])
    expect(body.passage.questions).toHaveLength(2)
    expect(body.passage.questions[0]).toMatchObject({ question: 'Question 1?', explanation: 'Because 1.' })
    expect([...body.passage.questions[0].options].sort()).toEqual(['a1', 'b1', 'c1', 'd1'])
    expect(body.passage.questions[0].correct_answer).toBe('b1')
    expect((await as('GET', '/api/parent/passages/9')).status).toBe(404)
  })

  it('L21: deleting a passage with a recorded result is refused (409) and nothing is removed', async () => {
    const deleted = bucket()
    await save(passage(3))
    await run("UPDATE passages SET image = '1.png' WHERE id = 1")
    await recorded(1)
    const { status, body } = await as('DELETE', '/api/parent/passages/1')
    expect([status, body.error]).toEqual([409, 'has_results'])
    expect(await count('SELECT COUNT(*) AS n FROM passages')).toBe(1)
    expect(await count('SELECT COUNT(*) AS n FROM questions')).toBe(3)
    expect(await count('SELECT COUNT(*) AS n FROM choices')).toBe(12)
    expect(deleted).toEqual([])
  })

  it('L21: a left-early result counts too, since it points at the passage', async () => {
    await save(passage(2))
    await recorded(1, 0)
    expect((await as('DELETE', '/api/parent/passages/1')).status).toBe(409)
  })

  it('L21: deleting one with no result removes it with its questions, choices, attempts and picture', async () => {
    const deleted = bucket()
    await save(passage(3))
    await save(passage(2, { title: 'Keep me' }))
    await run("UPDATE passages SET image = '1.png' WHERE id = 1")
    expect((await start()).status).toBe(200) // an unchecked attempt at passage 1
    const { status } = await as('DELETE', '/api/parent/passages/1')
    expect(status).toBe(200)
    expect(deleted).toEqual(['1.png'])
    expect(await count('SELECT COUNT(*) AS n FROM passages WHERE id = 1')).toBe(0)
    expect(await count('SELECT COUNT(*) AS n FROM questions WHERE passage_id = 1')).toBe(0)
    expect(await count('SELECT COUNT(*) AS n FROM choices WHERE question_id BETWEEN 101 AND 150')).toBe(0)
    expect(await count('SELECT COUNT(*) AS n FROM reading_attempts')).toBe(0)
    // The other passage is untouched, and the deleted ids come back to nobody.
    expect(await count('SELECT COUNT(*) AS n FROM questions WHERE passage_id = 2')).toBe(2)
    expect((await save(passage(1, { title: 'New' }))).body.id).toBe(3)
    const next = await start()
    expect(next.body.attempt).toBe(2)
  })

  it('deleting (or editing) one that is not there is a 404', async () => {
    expect((await as('DELETE', '/api/parent/passages/7')).status).toBe(404)
    expect((await as('PUT', '/api/parent/passages/7', { passage: passage() })).status).toBe(404)
  })

  it('L22: editing a question voids her unchecked attempt, so her next start is the edited passage', async () => {
    await save(passage(3))
    await recorded(1) // finished earlier, kept
    const before = (await start()).body
    expect(before.passage.questions).toHaveLength(3)
    const edited = passage(3)
    edited.questions[1] = question(2, { question: 'A new second question?' })
    const { status } = await as('PUT', '/api/parent/passages/1', { passage: edited })
    expect(status).toBe(200)
    expect(await count(`SELECT COUNT(*) AS n FROM reading_attempts WHERE id = ${before.attempt}`)).toBe(0)
    expect(await count('SELECT COUNT(*) AS n FROM reading_attempts WHERE used = 1')).toBe(1)
    const after = (await start()).body
    expect(after.attempt).toBeGreaterThan(before.attempt)
    expect(after.passage.questions.map((q: any) => q.text)).toContain('A new second question?')
    // The old attempt's result can no longer be recorded.
    const stale = await t.call('POST', '/api/reading/result', {
      body: {
        attempt: before.attempt,
        day: '2026-10-17',
        picks: before.passage.questions.map((q: any) => ({ question: q.id, choice: q.choices[0].id })),
      },
    })
    expect(stale.status).toBe(404)
  })

  it('an edit that leaves the questions alone keeps her attempt, the choices order and the picture', async () => {
    await save(passage(3))
    await run("UPDATE passages SET image = '1.png' WHERE id = 1")
    const before = (await start()).body
    // The stored order of the choices, by what they say: ids never change, so only text shows a reshuffle.
    const order = async () =>
      (
        await t.db
          .prepare('SELECT text, correct FROM choices WHERE question_id = 101 ORDER BY position')
          .all()
      ).results
    const orderBefore = await order()
    const retitled = passage(3, { title: 'A better title', minutes: 4, hint: 'Think of seeds.' })
    // The same questions, with the choices pasted in another order.
    retitled.questions[0] = { ...question(1), options: ['d1', 'c1', 'b1', 'a1'] }
    expect((await as('PUT', '/api/parent/passages/1', { passage: retitled })).status).toBe(200)
    expect(await one('SELECT title, minutes, hint, image FROM passages WHERE id = 1')).toEqual({
      title: 'A better title',
      minutes: 4,
      hint: 'Think of seeds.',
      image: '1.png',
    })
    expect(await count(`SELECT COUNT(*) AS n FROM reading_attempts WHERE id = ${before.attempt}`)).toBe(1)
    expect(await order()).toEqual(orderBefore)
    expect((await start()).body.attempt).toBe(before.attempt)
  })

  it('an edit that fails the checks is refused (400) and leaves the passage as it was', async () => {
    await save(passage(3))
    const bad = passage(3)
    bad.questions[0] = question(1, { correct_answer: 'nope' })
    const { status, body } = await as('PUT', '/api/parent/passages/1', { passage: bad })
    expect([status, body.error]).toEqual([400, 'bad_passage'])
    expect(body.problems.length).toBeGreaterThan(0)
    expect(await one('SELECT title FROM passages WHERE id = 1')).toEqual({ title: 'The Little Seed' })
    expect(await count('SELECT COUNT(*) AS n FROM questions')).toBe(3)
  })

  it('the list, the JSON, edit and delete all need an Access token', async () => {
    await save(passage())
    for (const [method, path] of [
      ['GET', '/api/parent/passages'],
      ['GET', '/api/parent/passages/1'],
      ['PUT', '/api/parent/passages/1'],
      ['DELETE', '/api/parent/passages/1'],
    ] as const) {
      expect(
        (
          await t.call(method, path, {
            key: null,
            body: method === 'GET' || method === 'DELETE' ? undefined : { passage: passage() },
          })
        ).status,
        path,
      ).toBe(401)
    }
    expect(await count('SELECT COUNT(*) AS n FROM passages')).toBe(1)
  })
})
