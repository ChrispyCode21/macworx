// The upgrade from a 0012 database to 0013: `results` is rebuilt so it can hold spelling results (SPEC §6.8).
import { convertV4MiniflareOptions, Miniflare } from 'miniflare'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { migrationStatements } from './test/db'

let mf: Miniflare
let db: D1Database
const upTo12 = () => migrationStatements('0012_words.sql').length
const upgrade = async () => {
  for (const sql of migrationStatements().slice(upTo12())) await db.prepare(sql).run()
}
const run = (sql: string) => db.prepare(sql).run()
const rows = async (sql: string) => (await db.prepare(sql).all()).results as Record<string, any>[]

/** A result the way the running Worker writes it: named columns only. */
const oldMath = (seed: number) =>
  run(
    `INSERT INTO results (seed, device_id, child_id, day, answers, answered, correct, finished, grade, base,
     accuracy_bonus, streak_bonus, total, created_at, mix) VALUES (${seed}, 1, 1, 'd', '[]', 20, 20, 1, 'Excellent', 20, 4, 0, 24, 'x', '[{"operation":"division","level":"easy"}]')`,
  )
const oldReading = (attempt: number) =>
  run(
    `INSERT INTO results (kind, attempt, detail, device_id, child_id, day, answers, answered, correct, finished,
     grade, base, accuracy_bonus, streak_bonus, total, created_at) VALUES ('reading', ${attempt}, '{}', 1, 1, 'd', '[]', 3, 3, 1, 'Excellent', 20, 4, 0, 24, 'x')`,
  )

beforeEach(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default { fetch() { return new Response("") } }',
      d1Databases: ['DB'],
    }),
  )
  db = (await mf.getD1Database('DB')) as unknown as D1Database
  for (const sql of migrationStatements('0012_words.sql')) await db.prepare(sql).run()
  await run("INSERT INTO devices (id, key_hash, label, created_at) VALUES (1, 'h1', 'A', 'x')")
  await run("INSERT INTO passages (id, title, minutes, body) VALUES (1, 'S', 1, 'One.')")
  await run("INSERT INTO seeds (seed, device_id, issued_day) VALUES (11, 1, 'd'), (12, 1, 'd')")
  await run(
    "INSERT INTO reading_attempts (id, device_id, child_id, passage_id, issued_day) VALUES (1, 1, 1, 1, 'd')",
  )
})
afterEach(async () => {
  await mf.dispose()
})

describe('migration 0013', () => {
  it('keeps every result: ids, kinds, mixes and details are copied, with spelling_attempt empty', async () => {
    await oldMath(11)
    await oldReading(1)
    const before = await rows('SELECT * FROM results ORDER BY id')
    await upgrade()
    expect(await rows('SELECT * FROM results ORDER BY id')).toEqual(
      before.map((row) => ({ ...row, spelling_attempt: null })),
    )
  })

  it("still takes the running Worker's inserts for math and reading", async () => {
    await upgrade()
    await oldMath(12)
    await oldReading(1)
    expect((await rows('SELECT kind FROM results ORDER BY id')).map((r) => r.kind)).toEqual([
      'math',
      'reading',
    ])
  })

  it('takes a spelling result tied to a spelling attempt, once, and refuses mixed-up rows', async () => {
    await upgrade()
    await run(
      "INSERT INTO spelling_attempts (id, device_id, child_id, issued_day, words) VALUES (1, 1, 1, 'd', '[1]')",
    )
    const spelling = (attempt: string, seed: string, kind = 'spelling') =>
      run(
        `INSERT INTO results (kind, seed, spelling_attempt, detail, device_id, child_id, day, answers, answered, correct,
         finished, grade, base, accuracy_bonus, streak_bonus, total, created_at)
         VALUES ('${kind}', ${seed}, ${attempt}, '{}', 1, 1, 'd', '[]', 1, 1, 1, 'Excellent', 1, 0, 0, 1, 'x')`,
      )
    await spelling('1', 'NULL')
    // The same attempt twice, a spelling result with no attempt or with a seed, and a math result with an attempt.
    await expect(spelling('1', 'NULL')).rejects.toThrow()
    await expect(spelling('NULL', 'NULL')).rejects.toThrow()
    await expect(spelling('1', '11')).rejects.toThrow()
    await expect(spelling('1', 'NULL', 'math')).rejects.toThrow()
    expect(await rows('SELECT kind, spelling_attempt FROM results')).toEqual([
      { kind: 'spelling', spelling_attempt: 1 },
    ])
  })

  it("numbers spelling attempts apart from reading attempts: the same id in both doesn't clash", async () => {
    await upgrade()
    await run(
      "INSERT INTO spelling_attempts (id, device_id, child_id, issued_day, words) VALUES (1, 1, 1, 'd', '[1]')",
    )
    await oldReading(1)
    await run(
      `INSERT INTO results (kind, spelling_attempt, detail, device_id, child_id, day, answers, answered, correct,
       finished, grade, base, accuracy_bonus, streak_bonus, total, created_at)
       VALUES ('spelling', 1, '{}', 1, 1, 'd', '[]', 1, 1, 1, 'Excellent', 1, 0, 0, 1, 'x')`,
    )
    expect(await rows('SELECT COUNT(*) AS n FROM results')).toEqual([{ n: 2 }])
  })

  it('keeps the child index', async () => {
    await upgrade()
    expect(
      (await rows("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'results'")).map(
        (r) => r.name,
      ),
    ).toContain('results_child')
  })
})
