// The spelling assignment on the Worker (SPEC §5.7, §6.8, §6.11, §7.E, §7.D): her next words, marking and paying.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearAccessKeys } from './access'
import { accessToken } from './test/access-keys'
import { handle } from './index'
import { CHILD2_KEY, createTestDb, DEVICE_KEY, OTHER_KEY } from './test/db'

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

const at = (day: string) => new Date(`${day}T12:00:00Z`)
const count = async (table: string) =>
  (await t.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())!.n
const balance = async () =>
  (await t.db.prepare('SELECT balance, completed, streak FROM children WHERE id = 1').first<any>())!

/** `n` words, wa, wb and so on, with ids 1 to n. */
async function words(n: number, from = 1) {
  // Words are letters only, so the number becomes a letter: 1 is wa, 2 is wb.
  const name = (i: number) => `w${String.fromCharCode(96 + i)}`
  for (let i = from; i < from + n; i++)
    await t.db
      .prepare(
        'INSERT INTO words (id, word, key, sentence, alternates, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .bind(i, name(i), name(i), `Say ${name(i)}.`, '[]', 'x')
      .run()
}

const start = (opts: { key?: string | null; now?: Date } = {}) =>
  t.call('POST', '/api/spelling/start', { now: at('2026-10-17'), ...opts })
const ids = (body: Record<string, any>) => body.words.map((w: any) => w.id)

/** Answers for a started attempt: the first `right` words typed right, the rest wrong. */
const answers = (body: Record<string, any>, right: number) =>
  body.words.map((w: any, i: number) => ({ word: w.id, typed: i < right ? w.word : 'zzz' }))

async function finish(right: number, day = '2026-10-17', key?: string) {
  const { body } = await start({ now: at(day), ...(key ? { key } : {}) })
  const done = await t.call('POST', '/api/spelling/result', {
    body: { attempt: body.attempt, day, answers: answers(body, right) },
    now: at(day),
    ...(key ? { key } : {}),
  })
  return { started: body, ...done }
}

describe('POST /api/spelling/start', () => {
  it('E8: the first start gives ids 1 to 20, the next 21 to 25 and then the oldest finished', async () => {
    await words(25)
    const first = await finish(20)
    expect(ids(first.started)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))
    expect(first.status).toBe(201)
    const second = await start()
    expect(ids(second.body)).toEqual([21, 22, 23, 24, 25, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
  })

  it('puts a word added after she finished the others first, then the oldest finished', async () => {
    await words(4)
    await finish(4)
    await words(1, 5)
    expect(ids((await start()).body)).toEqual([5, 1, 2, 3, 4])
  })

  it('E9: a list of 8 words gives all 8', async () => {
    await words(8)
    expect(ids((await start()).body)).toHaveLength(8)
  })

  it('E10: leaving before Check records nothing, and the next start gives the same words and attempt', async () => {
    await words(25)
    const a = await start({ now: at('2026-10-17') })
    const b = await start({ now: at('2026-10-18') })
    expect(b.body).toEqual(a.body)
    expect(await count('results')).toBe(0)
    expect(await count('spelling_attempts')).toBe(1)
    // Its day moves to the day it is handed out again.
    expect((await t.db.prepare('SELECT issued_day FROM spelling_attempts').first<any>())!.issued_day).toBe(
      '2026-10-18',
    )
  })

  it('E12: each word has its id, word, sentence and alternates, and nothing else', async () => {
    await words(1)
    await t.db.prepare('UPDATE words SET alternates = \'["wax"]\', grade = 3').run()
    const { body } = await start()
    expect(body.words).toEqual([{ id: 1, word: 'wa', sentence: 'Say wa.', alternates: ['wax'] }])
    expect(Object.keys(body).sort()).toEqual(['attempt', 'words'])
  })

  it('E13: no key or a wrong key is refused (401) on start and on result, and nothing is recorded', async () => {
    await words(3)
    const body = { attempt: 1, day: '2026-10-17', answers: [{ word: 1, typed: 'wa' }] }
    for (const key of [null, 'not-a-device-key']) {
      expect((await start({ key })).status).toBe(401)
      expect((await t.call('POST', '/api/spelling/result', { body, key })).status).toBe(401)
    }
    expect([await count('spelling_attempts'), await count('results')]).toEqual([0, 0])
  })

  it('E15: with no words the start has none, and records no attempt', async () => {
    const { status, body } = await start()
    expect([status, body]).toEqual([200, { words: null }])
    expect(await count('spelling_attempts')).toBe(0)
  })

  it("does not hand one device's unchecked attempt to another device or child", async () => {
    await words(3)
    const a = await start()
    const other = await start({ key: OTHER_KEY })
    const child2 = await start({ key: CHILD2_KEY })
    expect(new Set([a.body.attempt, other.body.attempt, child2.body.attempt]).size).toBe(3)
  })
})

describe('POST /api/spelling/result', () => {
  it('pays 1 per correct word, the accuracy bonus and the streak bonus, and grades it (E1)', async () => {
    await words(20)
    const { status, body } = await finish(20)
    expect(status).toBe(201)
    expect(body.result.payout).toEqual({ base: 20, accuracyBonus: 4, streakBonus: 1, total: 25 })
    expect(body.result).toMatchObject({ correct: 20, answered: 20, finished: true, grade: 'Excellent' })
    expect(body.state).toMatchObject({ balance: 25, completed: 1, streak: 1 })
  })

  it('does not scale the base for a short list (E3), and pays the minimum for none right (E4)', async () => {
    await words(5)
    const first = await finish(4)
    // The first of the day, streak 1: base 4, no bonus, streak bonus 1.
    expect(first.body.result.payout).toEqual({ base: 4, accuracyBonus: 0, streakBonus: 1, total: 5 })
    expect(first.body.result.grade).toBe('Good')
    const second = await finish(0)
    expect(second.body.result.payout).toMatchObject({ base: 0, total: 1 })
  })

  it('E11: the same attempt sent twice comes back as recorded and counts once', async () => {
    await words(3)
    const { started, body } = await finish(3)
    const again = await t.call('POST', '/api/spelling/result', {
      body: { attempt: started.attempt, day: '2026-10-17', answers: answers(started, 0) },
      now: at('2026-10-17'),
    })
    expect(again.status).toBe(200)
    expect(again.body.result).toEqual(body.result)
    expect(await balance()).toMatchObject({ balance: body.result.payout.total, completed: 1 })
    expect(await count('results')).toBe(1)
  })

  it('E14: answers that miss a word or name another word are refused, record nothing, and the attempt still works', async () => {
    await words(3)
    const { body } = await start()
    const send = (list: unknown) =>
      t.call('POST', '/api/spelling/result', {
        body: { attempt: body.attempt, day: '2026-10-17', answers: list },
        now: at('2026-10-17'),
      })
    const good = answers(body, 3)
    for (const list of [
      good.slice(1),
      [...good.slice(0, 2), { word: 99, typed: 'wc' }],
      [...good.slice(0, 2), good[0]],
      [...good, { word: 99, typed: 'x' }],
    ]) {
      const refused = await send(list)
      expect([refused.status, refused.body.error]).toEqual([400, 'bad_answers'])
    }
    for (const list of [
      'nope',
      [{ word: 1 }],
      [{ word: 1, typed: 5 }],
      [{ word: 1, typed: 'x'.repeat(101) }],
    ]) {
      expect((await send(list)).status).toBe(400)
    }
    const empty = await send([])
    expect([empty.status, empty.body.error]).toEqual([400, 'bad_answers'])
    expect([await count('results'), (await balance()).balance]).toEqual([0, 0])
    expect((await send(good)).status).toBe(201)
  })

  it("refuses an attempt that isn't this device's, or isn't there, with 404", async () => {
    await words(3)
    const { body } = await start()
    for (const [key, attempt] of [
      [OTHER_KEY, body.attempt],
      [CHILD2_KEY, body.attempt],
      [undefined, 999],
    ] as const) {
      const r = await t.call('POST', '/api/spelling/result', {
        body: { attempt, day: '2026-10-17', answers: answers(body, 3) },
        ...(key ? { key } : {}),
      })
      expect([r.status, r.body.error]).toEqual([404, 'unknown_attempt'])
    }
  })

  it('a day from a wrong clock is paid but leaves the streak alone', async () => {
    await words(3)
    const { started } = await start().then((s) => ({ started: s.body }))
    const r = await t.call('POST', '/api/spelling/result', {
      body: { attempt: started.attempt, day: '2030-01-01', answers: answers(started, 3) },
      now: at('2026-10-17'),
    })
    expect(r.status).toBe(201)
    expect(r.body.result.payout.streakBonus).toBe(0)
    expect(r.body.state).toMatchObject({ streak: 0, completed: 1 })
  })

  it('marks again on the Worker: a right word is right whatever the iPad said, with its alternates', async () => {
    await words(2)
    await t.db.prepare('UPDATE words SET alternates = \'["colour"]\' WHERE id = 1').run()
    const { body } = await start()
    const r = await t.call('POST', '/api/spelling/result', {
      body: {
        attempt: body.attempt,
        day: '2026-10-17',
        answers: [
          { word: 1, typed: ' Colour ' },
          { word: 2, typed: 'wc' },
        ],
      },
      now: at('2026-10-17'),
    })
    expect(r.body.result.words).toEqual([
      { id: 1, right: true, rightSpelling: 'wa' },
      { id: 2, right: false, rightSpelling: 'wb' },
    ])
  })
})

describe('editing and deleting words (E19, D15)', () => {
  const patch = (id: number, body: unknown) =>
    t.call('PATCH', `/api/parent/words/${id}`, { key: null, accessToken: token, body })
  const del = (id: number) => t.call('DELETE', `/api/parent/words/${id}`, { key: null, accessToken: token })

  it('E19: deleting a word in an unchecked attempt voids it, and her next start is new words', async () => {
    await words(3)
    const { body } = await start()
    expect((await del(2)).status).toBe(200)
    expect(await count('spelling_attempts')).toBe(0)
    const r = await t.call('POST', '/api/spelling/result', {
      body: { attempt: body.attempt, day: '2026-10-17', answers: answers(body, 3) },
      now: at('2026-10-17'),
    })
    expect(r.status).toBe(404)
    const next = await start()
    expect(ids(next.body)).toEqual([1, 3])
    expect(next.body.attempt).not.toBe(body.attempt)
  })

  it('E19: changing a word, its sentence or its alternates voids it; a grade, or the same text, does not', async () => {
    await words(3)
    const { body } = await start()
    expect((await patch(1, { grade: 2 })).status).toBe(200)
    expect((await patch(1, { sentence: 'Say wa.', word: 'wa', alternates: [] })).status).toBe(200)
    expect(await count('spelling_attempts')).toBe(1)
    for (const change of [{ word: 'wab' }, { sentence: 'New.' }, { alternates: ['wac'] }]) {
      await start()
      expect(await count('spelling_attempts')).toBe(1)
      expect((await patch(1, change)).status).toBe(200)
      expect(await count('spelling_attempts')).toBe(0)
    }
    expect(body.attempt).toBe(1)
  })

  it('an edit of a word that is in no attempt, or in a checked one, leaves the attempts alone', async () => {
    await words(3)
    const done = await finish(3)
    expect(done.status).toBe(201)
    expect((await patch(1, { word: 'wab' })).status).toBe(200)
    expect((await del(2)).status).toBe(200)
    expect(await count('spelling_attempts')).toBe(1)
    expect(await count('results')).toBe(1)
  })

  it('voids only the unchecked attempts that hold the word', async () => {
    await words(3)
    const a = await start()
    await words(1, 4)
    // Another device's attempt holds all four words; hers keeps its three.
    const other = await start({ key: OTHER_KEY })
    expect(ids(other.body)).toEqual([1, 2, 3, 4])
    expect((await patch(4, { sentence: 'New.' })).status).toBe(200)
    const left = await t.db.prepare('SELECT id FROM spelling_attempts').all<any>()
    expect(left.results.map((r) => r.id)).toEqual([a.body.attempt])
  })

  it('a new word never takes the id of a deleted one, so it comes before words she has done', async () => {
    await words(3)
    await finish(3)
    expect((await del(3)).status).toBe(200)
    const added = await t.call('POST', '/api/parent/words', {
      key: null,
      accessToken: token,
      body: { words: [{ word: 'fresh' }] },
    })
    expect(added.status).toBe(201)
    const row = await t.db.prepare("SELECT id FROM words WHERE word = 'fresh'").first<any>()
    expect(row!.id).toBeGreaterThan(3)
    expect(ids((await start()).body)[0]).toBe(row!.id)
  })

  it('D15: a recorded result keeps each word, its alternates, her typing and whether it matched', async () => {
    await words(3)
    await t.db.prepare('UPDATE words SET alternates = \'["wax"]\' WHERE id = 1').run()
    const { body } = await start()
    await t.call('POST', '/api/spelling/result', {
      body: {
        attempt: body.attempt,
        day: '2026-10-17',
        answers: [
          { word: 1, typed: 'wax' },
          { word: 2, typed: 'oops' },
          { word: 3, typed: 'wc' },
        ],
      },
      now: at('2026-10-17'),
    })
    await patch(1, { word: 'renamed', alternates: [] })
    await del(2)
    const list = await t.call('GET', '/api/parent/results', { key: null, accessToken: token })
    expect(list.body.results[0]).toMatchObject({
      kind: 'spelling',
      title: null,
      mix: null,
      answered: 3,
      correct: 2,
      finished: true,
    })
    const one = await t.call('GET', `/api/parent/results/${list.body.results[0].id}`, {
      key: null,
      accessToken: token,
    })
    expect(one.body.result).toMatchObject({ kind: 'spelling', answered: 3, correct: 2, grade: 'Improving' })
    expect(one.body.result.words).toEqual([
      { word: 'wa', alternates: ['wax'], typed: 'wax', matched: true },
      { word: 'wb', alternates: [], typed: 'oops', matched: false },
      { word: 'wc', alternates: [], typed: 'wc', matched: true },
    ])
  })
})

describe('while a result is on its way', () => {
  /** The Worker with `before` run once just before it writes a result (the batch), as if it happened meanwhile. */
  const racing = (before: () => Promise<unknown>) => {
    let fired = false
    const db = new Proxy(t.db, {
      get(target, prop) {
        if (prop === 'batch')
          return async (statements: D1PreparedStatement[]) => {
            if (!fired) {
              fired = true
              await before()
            }
            return target.batch(statements)
          }
        const value = Reflect.get(target, prop)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
    return { ...t.env, DB: db as D1Database }
  }
  const send = (env: typeof t.env, body: Record<string, any>) =>
    handle(
      new Request('https://macworx.test/api/spelling/result', {
        method: 'POST',
        headers: { Authorization: `Bearer ${DEVICE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ attempt: body.attempt, day: '2026-10-17', answers: answers(body, 3) }),
      }),
      env,
      at('2026-10-17'),
      t.certs.fetchCerts,
    )

  it('a word edited meanwhile voids the attempt: 404, nothing paid or recorded', async () => {
    await words(3)
    const { body } = await start()
    const env = racing(() =>
      t.db.prepare('DELETE FROM spelling_attempts WHERE id = ?').bind(body.attempt).run(),
    )
    expect((await send(env, body)).status).toBe(404)
    expect([await count('results'), (await balance()).balance]).toEqual([0, 0])
  })

  it('an iPad unpaired meanwhile is refused (401), nothing paid or recorded', async () => {
    await words(3)
    const { body } = await start()
    const env = racing(() => t.db.prepare("UPDATE devices SET revoked_at = 'x' WHERE id = 1").run())
    expect((await send(env, body)).status).toBe(401)
    expect([await count('results'), (await balance()).balance]).toEqual([0, 0])
  })

  it('two results at once for one attempt record and pay once', async () => {
    await words(3)
    const { body } = await start()
    const both = await Promise.all([send(t.env, body), send(t.env, body)])
    expect(both.map((r) => r.status).sort()).toEqual([200, 201])
    expect(await count('results')).toBe(1)
    expect((await balance()).completed).toBe(1)
  })
})
