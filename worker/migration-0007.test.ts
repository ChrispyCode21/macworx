// The upgrade from a 0006 database to 0007: reading attempts, and `results` rebuilt for every kind of
// assignment (SPEC §6.8). Rows here are tiny stand-ins.
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
})
afterEach(async () => {
  await mf.dispose()
})

const run = (sql: string) => db.prepare(sql).run()
const rows = async (sql: string) => (await db.prepare(sql).all()).results as Record<string, any>[]
const migrate = async () => {
  const before = migrationStatements('0006_reading_passages.sql').length
  for (const sql of migrationStatements().slice(before)) await db.prepare(sql).run()
}

/** A math result as the old Worker writes it: named columns, nothing about kind, attempt or detail. */
const oldInsert = (seed: number, extra = '') =>
  run(
    `INSERT INTO results (seed, device_id, child_id, day, answers, answered, correct, finished, grade, base, accuracy_bonus, streak_bonus, total, created_at)
     VALUES (${seed}, 1, 1, '2026-10-17', '[1,2,3]', 20, 18, 1, 'Great', 18, 3, ${extra || 1}, 22, '2026-10-17T12:00:00Z')`,
  )

async function seedOld() {
  await run(
    "INSERT INTO devices (id, key_hash, label, created_at) VALUES (1, 'h1', 'A', '2026-10-01T00:00:00Z')",
  )
  await run(
    "INSERT INTO devices (id, key_hash, label, created_at) VALUES (2, 'h2', 'B', '2026-10-01T00:00:00Z')",
  )
  await run(
    "INSERT INTO children (id, name, initials, created_at) VALUES (2, 'Sib', 'S', '2026-10-01T00:00:00Z')",
  )
  for (const seed of [101, 102, 103, 104])
    await run(
      `INSERT INTO seeds (seed, device_id, issued_day, used) VALUES (${seed}, ${seed === 104 ? 2 : 1}, '2026-10-17', 1)`,
    )
  await oldInsert(101)
  await run(
    "INSERT INTO results (seed, device_id, child_id, day, answers, answered, correct, finished, grade, base, accuracy_bonus, streak_bonus, total, created_at) VALUES (102, 1, 1, '2026-10-18', '[5]', 8, 7, 0, NULL, 7, 0, 0, 7, '2026-10-18T09:00:00Z')",
  )
  await run(
    "INSERT INTO results (seed, device_id, child_id, day, answers, answered, correct, finished, grade, base, accuracy_bonus, streak_bonus, total, created_at) VALUES (104, 2, 2, '2026-10-19', '[9,9]', 20, 20, 1, 'Excellent', 20, 4, 3, 27, '2026-10-19T09:00:00Z')",
  )
}

describe('migration 0007', () => {
  it('keeps every math result, with its id and every column, as kind math', async () => {
    await seedOld()
    const before = await rows('SELECT * FROM results ORDER BY id')
    expect(before).toHaveLength(3)
    await migrate()
    const after = await rows('SELECT * FROM results ORDER BY id')
    expect(after).toHaveLength(3)
    for (const [i, row] of before.entries())
      expect(after[i]).toEqual({ ...row, kind: 'math', attempt: null, detail: null })
  })

  it('migrates a database with no results', async () => {
    await migrate()
    expect(await rows('SELECT * FROM results')).toEqual([])
  })

  it('keeps the results_child index and the seed rules (one result per seed)', async () => {
    await seedOld()
    await migrate()
    expect(
      await rows("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'results_child'"),
    ).toHaveLength(1)
    await expect(oldInsert(101)).rejects.toThrow()
    await run("INSERT INTO seeds (seed, device_id, issued_day) VALUES (105, 1, '2026-10-17')")
    await oldInsert(105)
  })

  it('lets the old Worker save a math result (named columns, no kind, attempt or detail)', async () => {
    await seedOld()
    await migrate()
    await run("INSERT INTO seeds (seed, device_id, issued_day) VALUES (200, 1, '2026-10-20')")
    await oldInsert(200)
    const row = (await rows('SELECT * FROM results WHERE seed = 200'))[0]
    expect(row).toMatchObject({ kind: 'math', attempt: null, detail: null, seed: 200 })
    expect(await rows('SELECT * FROM results WHERE seed = 200')).toHaveLength(1)
  })

  it('stores a reading result tied to one attempt, and refuses a second for the same attempt', async () => {
    await seedOld()
    await migrate()
    await run("INSERT INTO passages (id, title, minutes, body) VALUES (1, 'A', 1, 'Text.')")
    await run(
      "INSERT INTO reading_attempts (id, device_id, child_id, passage_id, issued_day) VALUES (1, 1, 1, 1, '2026-10-20')",
    )
    const reading = (attempt: number, extra = '') =>
      run(
        `INSERT INTO results (kind, attempt, detail, device_id, child_id, day, answers, answered, correct, finished, grade, base, accuracy_bonus, streak_bonus, total, created_at${extra})
         VALUES ('reading', ${attempt}, '{"title":"A"}', 1, 1, '2026-10-20', '[1,2]', 10, 8, 1, 'Good', 16, 3, 0, 19, '2026-10-20T12:00:00Z'${extra && ', 0'})`,
      )
    await reading(1)
    expect((await rows("SELECT seed, attempt, kind FROM results WHERE kind = 'reading'"))[0]).toEqual({
      seed: null,
      attempt: 1,
      kind: 'reading',
    })
    await expect(reading(1)).rejects.toThrow()
  })

  it('refuses a result whose shape does not match its kind', async () => {
    await seedOld()
    await migrate()
    await run("INSERT INTO passages (id, title, minutes, body) VALUES (1, 'A', 1, 'Text.')")
    await run(
      "INSERT INTO reading_attempts (id, device_id, child_id, passage_id, issued_day) VALUES (1, 1, 1, 1, '2026-10-20')",
    )
    await run("INSERT INTO seeds (seed, device_id, issued_day) VALUES (300, 1, '2026-10-20')")
    const insert = (cols: string, vals: string) =>
      run(
        `INSERT INTO results (${cols}, device_id, child_id, day, answers, answered, correct, finished, base, accuracy_bonus, streak_bonus, total, created_at)
         VALUES (${vals}, 1, 1, '2026-10-20', '[]', 1, 1, 1, 1, 0, 0, 1, 'x')`,
      )
    await expect(insert('kind, seed, attempt, detail', "'math', 300, 1, NULL")).rejects.toThrow() // seed and attempt
    await expect(insert('kind, seed, detail', "'math', 300, '{}'")).rejects.toThrow() // math with detail
    await expect(insert('kind', "'math'")).rejects.toThrow() // math with no seed
    await expect(insert('kind, attempt', "'reading', 1")).rejects.toThrow() // reading with no detail
    await expect(insert('kind, seed, detail', "'reading', 300, '{}'")).rejects.toThrow() // reading with a seed
    await expect(insert('kind, attempt, detail', "'other', 1, '{}'")).rejects.toThrow() // unknown kind
  })

  it('adds reading_attempts with its indexes and changes no other table', async () => {
    await migrate()
    const names = (await rows("SELECT name FROM sqlite_master WHERE name LIKE 'reading_attempts%'")).map(
      (r) => r.name,
    )
    expect(names.sort()).toEqual([
      'reading_attempts',
      'reading_attempts_child_passage',
      'reading_attempts_unused',
    ])
    const schema = async (d: D1Database) =>
      (
        await d
          .prepare("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name")
          .all()
      ).results as {
        name: string
        sql: string
      }[]
    const after = (await schema(db)).filter((r) => !/^(reading_attempts|results)/.test(r.name))
    const fresh = new Miniflare(
      convertV4MiniflareOptions({
        modules: true,
        script: 'export default { fetch() { return new Response("") } }',
        d1Databases: ['DB'],
      }),
    )
    try {
      const d = (await fresh.getD1Database('DB')) as unknown as D1Database
      for (const sql of migrationStatements('0006_reading_passages.sql')) await d.prepare(sql).run()
      const before = (await schema(d)).filter((r) => !/^(reading_attempts|results)/.test(r.name))
      expect(after).toEqual(before)
    } finally {
      await fresh.dispose()
    }
  })
})
