// The upgrade from a 0003 database to 0004 (children): everything existing belongs to child 1,
// and code written before 0004 keeps working.
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
  for (const sql of migrationStatements('0003_pairing.sql')) await db.prepare(sql).run()
  const run = (sql: string) => db.prepare(sql).run()
  await run(
    "UPDATE child SET balance = 40, streak = 3, last_day = '2026-10-16', completed = 5, revision = 'r1' WHERE id = 1",
  )
  await run(
    "INSERT INTO devices (key_hash, label, created_at) VALUES ('k1', 'her iPad', '2026-10-01T00:00:00Z')",
  )
  await run(
    "INSERT INTO seeds (seed, device_id, issued_day, used) VALUES (11, 1, '2026-10-15', 1), (12, 1, '2026-10-16', 1)",
  )
  for (const seed of [11, 12])
    await run(
      `INSERT INTO results (seed, device_id, day, answers, answered, correct, finished, grade, base, accuracy_bonus, streak_bonus, total, created_at)
       VALUES (${seed}, 1, '2026-10-15', '[]', 10, 10, 1, 'Excellent', 10, 5, 0, 15, '2026-10-15T10:00:00Z')`,
    )
  await run(
    "INSERT INTO admin_log (at, email, action) VALUES ('2026-10-16T10:00:00Z', 'p@example.com', 'pair')",
  )
  await run(
    "INSERT INTO pairing_codes (code_hash, name, created_at, expires_at) VALUES ('h', 'iPad', '2026-10-16T10:00:00Z', '2026-10-16T10:10:00Z')",
  )
  for (const sql of migrationStatements().slice(migrationStatements('0003_pairing.sql').length))
    await db.prepare(sql).run()
})
afterEach(async () => {
  await mf.dispose()
})

const rows = async (sql: string) => (await db.prepare(sql).all()).results as Record<string, any>[]

describe('migration 0004', () => {
  it('seeds one child named "Child" from the existing child row', async () => {
    expect(await rows('SELECT * FROM children')).toEqual([
      expect.objectContaining({
        id: 1,
        name: 'Child',
        grade: '',
        initials: 'C',
        balance: 40,
        streak: 3,
        last_day: '2026-10-16',
        completed: 5,
        revision: 'r1',
      }),
    ])
  })

  it('gives every existing row child 1 and loses none', async () => {
    for (const [table, count] of [
      ['devices', 1],
      ['results', 2],
      ['admin_log', 1],
      ['pairing_codes', 1],
    ] as const) {
      const all = await rows(`SELECT child_id FROM ${table}`)
      expect(all).toHaveLength(count)
      expect(all.every((r) => r.child_id === 1)).toBe(true)
    }
  })

  it('accepts inserts written before 0004 and files them under child 1', async () => {
    const run = (sql: string) => db.prepare(sql).run()
    await run("INSERT INTO devices (key_hash, label, created_at) VALUES ('k2', 'x', '2026-10-17T00:00:00Z')")
    await run("INSERT INTO seeds (seed, device_id, issued_day) VALUES (13, 2, '2026-10-17')")
    await run(
      `INSERT INTO results (seed, device_id, day, answers, answered, correct, finished, grade, base, accuracy_bonus, streak_bonus, total, created_at)
       VALUES (13, 2, '2026-10-17', '[]', 1, 1, 0, NULL, 1, 0, 0, 1, '2026-10-17T10:00:00Z')`,
    )
    await run(
      "INSERT INTO admin_log (at, email, action, detail) VALUES ('2026-10-17T10:00:00Z', 'p@example.com', 'x', '{}')",
    )
    await run(
      "INSERT INTO pairing_codes (code_hash, name, created_at, expires_at) VALUES ('h2', 'iPad', '2026-10-17T10:00:00Z', '2026-10-17T10:10:00Z')",
    )
    for (const table of ['devices', 'results', 'admin_log', 'pairing_codes'])
      expect((await rows(`SELECT child_id FROM ${table} ORDER BY id DESC LIMIT 1`))[0]?.child_id).toBe(1)
  })

  it('lets old code update child (one row changed, as it checks), and child keeps its CHECK', async () => {
    const update = await db
      .prepare("UPDATE child SET balance = balance + 20, revision = 'r2' WHERE id = 1 AND revision = 'r1'")
      .run()
    expect(update.meta.changes).toBe(1)
    expect((await rows('SELECT balance, revision FROM child WHERE id = 1'))[0]).toEqual({
      balance: 60,
      revision: 'r2',
    })
    await expect(db.prepare('INSERT INTO child (id) VALUES (2)').run()).rejects.toThrow()
  })

  it('can hold a second child with a device of her own', async () => {
    await db
      .prepare(
        "INSERT INTO children (id, name, initials, created_at) VALUES (2, 'Sib', 'S', '2026-10-17T00:00:00Z')",
      )
      .run()
    await db
      .prepare(
        "INSERT INTO devices (key_hash, label, created_at, child_id) VALUES ('k3', 'y', '2026-10-17T00:00:00Z', 2)",
      )
      .run()
    expect((await rows("SELECT child_id FROM devices WHERE key_hash = 'k3'"))[0]?.child_id).toBe(2)
    expect((await rows('SELECT balance, streak FROM children WHERE id = 2'))[0]).toEqual({
      balance: 0,
      streak: 0,
    })
  })

  it('adds child_id as NOT NULL with default 1 on the four tables', async () => {
    for (const table of ['devices', 'results', 'admin_log', 'pairing_codes']) {
      const col = (await rows(`PRAGMA table_info(${table})`)).find((c) => c.name === 'child_id')
      expect(col).toMatchObject({ notnull: 1, dflt_value: '1' })
    }
  })
})
