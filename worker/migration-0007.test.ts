// The upgrade from a 0006 database to 0007: `results` is rebuilt for every kind of assignment and reading
// attempts are added (SPEC §6.8). Rows here are tiny stand-ins.
import { convertV4MiniflareOptions, Miniflare } from 'miniflare'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { migrationStatements } from './test/db'

let mf: Miniflare
let db: D1Database
beforeEach(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default { fetch() { return new Response("") } }',
      d1Databases: ['DB'],
    }),
  )
  db = (await mf.getD1Database('DB')) as unknown as D1Database
  for (const sql of migrationStatements('0006_reading_passages.sql')) await db.prepare(sql).run()
  await run(
    "INSERT INTO devices (id, key_hash, label, created_at) VALUES (1, 'h1', 'A', 'x'), (2, 'h2', 'B', 'x')",
  )
  await run("INSERT INTO children (id, name, initials, created_at) VALUES (2, 'Sib', 'S', 'x')")
  await run(
    "INSERT INTO seeds (seed, device_id, issued_day, used) VALUES (101, 1, 'x', 1), (102, 1, 'x', 1), (200, 1, 'x', 0)",
  )
})
afterEach(async () => {
  await mf.dispose()
})

const run = (sql: string) => db.prepare(sql).run()
const rows = async (sql: string) => (await db.prepare(sql).all()).results as Record<string, any>[]
const columns =
  'device_id, child_id, day, answers, answered, correct, finished, grade, base, accuracy_bonus, streak_bonus, total, created_at'
/** The old Worker's INSERT: named columns, nothing about kind, attempt or detail. */
const oldInsert = (seed: number) =>
  run(
    `INSERT INTO results (seed, ${columns}) VALUES (${seed}, 1, 1, 'd', '[1]', 20, 18, 1, 'Great', 17, 3, 2, 22, 't')`,
  )

describe('migration 0007', () => {
  it('keeps every math result with its id and every column, applied as one batch like D1', async () => {
    await oldInsert(101)
    // Every number differs, so a swapped column can't pass.
    await run(
      `INSERT INTO results (seed, ${columns}) VALUES (102, 2, 2, 'e', '[5]', 8, 7, 0, NULL, 6, 1, 0, 9, 'u')`,
    )
    const before = await rows('SELECT * FROM results ORDER BY id')
    const statements = migrationStatements('0007_reading_results.sql').slice(
      migrationStatements('0006_reading_passages.sql').length,
    )
    await db.batch(statements.map((sql) => db.prepare(sql)))
    expect(await rows('SELECT * FROM results ORDER BY id')).toEqual(
      before.map((row) => ({ ...row, kind: 'math', attempt: null, detail: null })),
    )
    expect(await rows('PRAGMA foreign_key_check')).toEqual([])
    expect((await rows("PRAGMA index_info('results_child')")).map((r) => r.name)).toEqual(['child_id', 'id'])
  })

  it("still takes the old Worker's INSERT, as kind math, and keeps one result per seed", async () => {
    for (const sql of migrationStatements('0007_reading_results.sql').slice(
      migrationStatements('0006_reading_passages.sql').length,
    ))
      await db.prepare(sql).run()
    await oldInsert(200)
    expect(await rows('SELECT kind, attempt, detail FROM results WHERE seed = 200')).toEqual([
      { kind: 'math', attempt: null, detail: null },
    ])
    await expect(oldInsert(200)).rejects.toThrow()
  })

  describe('after the upgrade', () => {
    beforeEach(async () => {
      for (const sql of migrationStatements('0007_reading_results.sql').slice(
        migrationStatements('0006_reading_passages.sql').length,
      ))
        await db.prepare(sql).run()
      await run("INSERT INTO passages (id, title, minutes, body) VALUES (1, 'A', 1, 'Text.')")
      await run(
        "INSERT INTO reading_attempts (id, device_id, child_id, passage_id, issued_day) VALUES (1, 1, 1, 1, 'x')",
      )
    })
    const insert = (cols: string, vals: string) =>
      run(
        `INSERT INTO results (${cols}, ${columns}) VALUES (${vals}, 1, 1, 'd', '[]', 10, 8, 1, 'Good', 16, 3, 0, 19, 't')`,
      )

    it('stores a reading result tied to one attempt, once', async () => {
      await insert('kind, attempt, detail', "'reading', 1, '{}'")
      expect(await rows("SELECT seed, attempt FROM results WHERE kind = 'reading'")).toEqual([
        { seed: null, attempt: 1 },
      ])
      await expect(insert('kind, attempt, detail', "'reading', 1, '{}'")).rejects.toThrow()
    })

    it('refuses a result whose shape does not match its kind', async () => {
      await expect(insert('kind, seed, attempt, detail', "'math', 200, 1, NULL")).rejects.toThrow()
      await expect(insert('kind, seed, detail', "'math', 200, '{}'")).rejects.toThrow()
      await expect(insert('kind', "'math'")).rejects.toThrow()
      await expect(insert('kind, attempt', "'reading', 1")).rejects.toThrow()
      await expect(insert('kind, seed, attempt, detail', "'reading', 200, 1, '{}'")).rejects.toThrow()
      await expect(insert('kind, attempt, detail', "'other', 1, '{}'")).rejects.toThrow()
    })
  })
})
