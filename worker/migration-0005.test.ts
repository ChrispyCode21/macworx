// The upgrade from a 0004 database to 0005: the live numbers move from `child` to `children`.
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
  for (const sql of migrationStatements('0004_children.sql')) await db.prepare(sql).run()
})
afterEach(async () => {
  await mf.dispose()
})

const rows = async (sql: string) => (await db.prepare(sql).all()).results as Record<string, any>[]
const migrate = async () => {
  for (const sql of migrationStatements().slice(migrationStatements('0004_children.sql').length))
    await db.prepare(sql).run()
}

describe('migration 0005', () => {
  it('copies the live numbers from child to children 1 and keeps her name, grade, initials and start', async () => {
    // The 0004 copy is stale: the old Worker kept writing `child`.
    await db
      .prepare(
        "UPDATE children SET name = 'Renamed', grade = '4th', initials = 'RN', created_at = '2026-10-01T00:00:00Z' WHERE id = 1",
      )
      .run()
    await db
      .prepare(
        "UPDATE child SET balance = 55, streak = 4, last_day = '2026-10-17', completed = 7, revision = 'r9' WHERE id = 1",
      )
      .run()
    await migrate()
    expect((await rows('SELECT * FROM children WHERE id = 1'))[0]).toEqual({
      id: 1,
      name: 'Renamed',
      grade: '4th',
      initials: 'RN',
      created_at: '2026-10-01T00:00:00Z',
      balance: 55,
      streak: 4,
      last_day: '2026-10-17',
      completed: 7,
      revision: 'r9',
    })
  })

  it('does not touch another child', async () => {
    await db
      .prepare(
        "INSERT INTO children (id, name, initials, created_at, balance, streak, revision) VALUES (2, 'Sib', 'S', '2026-10-17T00:00:00Z', 9, 2, 'sib')",
      )
      .run()
    await db.prepare("UPDATE child SET balance = 55, revision = 'r9' WHERE id = 1").run()
    await migrate()
    expect((await rows('SELECT balance, streak, revision FROM children WHERE id = 2'))[0]).toEqual({
      balance: 9,
      streak: 2,
      revision: 'sib',
    })
  })

  it('leaves children 1 as it was when there is no child row', async () => {
    const before = await rows('SELECT * FROM children WHERE id = 1')
    await db.prepare('DELETE FROM child').run()
    await migrate()
    expect(await rows('SELECT * FROM children WHERE id = 1')).toEqual(before)
  })

  it('leaves child as it was', async () => {
    await db.prepare("UPDATE child SET balance = 55, revision = 'r9' WHERE id = 1").run()
    await migrate()
    expect((await rows('SELECT balance, revision FROM child'))[0]).toEqual({ balance: 55, revision: 'r9' })
  })
})
