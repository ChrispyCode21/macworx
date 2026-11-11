// Adding a passage from the parent portal (SPEC §6.10, §7.L): the second look at what the portal checked.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PASSAGE_LIMITS } from '../src/engine'
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

  it('saves two at once under different ids, or answers 503 for the one that lost', async () => {
    // A first call warms the Access keys, so the two below don't both fetch them at once.
    await t.call('GET', '/api/parent/children', { key: null, accessToken: token })
    const [a, b] = await Promise.all([save(passage(2)), save(passage(2))])
    const ok = [a, b].filter((r) => r.status === 201)
    expect(ok.length).toBeGreaterThanOrEqual(1)
    expect(await count('SELECT COUNT(*) AS n FROM passages')).toBe(ok.length)
    expect(await count('SELECT COUNT(*) AS n FROM questions')).toBe(2 * ok.length)
    for (const r of [a, b]) if (r.status !== 201) expect(r.status).toBe(503)
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
