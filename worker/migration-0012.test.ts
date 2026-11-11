// The upgrade from a 0011 database to 0012: a `words` table (SPEC §6.11).
import { convertV4MiniflareOptions, Miniflare } from 'miniflare'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { migrationStatements } from './test/db'

let mf: Miniflare
let db: D1Database
const upTo11 = () => migrationStatements('0011_passage_source.sql').length
const upgrade = async () => {
  for (const sql of migrationStatements().slice(upTo11())) await db.prepare(sql).run()
}
const run = (sql: string) => db.prepare(sql).run()
const insert = (word: string, key = word, alternates = '[]') =>
  run(
    `INSERT INTO words (word, key, alternates, created_at) VALUES ('${word}', '${key}', '${alternates}', 'now')`,
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
  for (const sql of migrationStatements('0011_passage_source.sql')) await db.prepare(sql).run()
})
afterEach(async () => {
  await mf.dispose()
})

describe('migration 0012', () => {
  it('only adds a table, and leaves the passages and results as they were', async () => {
    await run("INSERT INTO passages (id, title, minutes, body) VALUES (1, 'S', 1, 'One.')")
    await upgrade()
    expect((await db.prepare('SELECT COUNT(*) AS n FROM passages').first<{ n: number }>())!.n).toBe(1)
    expect((await db.prepare('SELECT COUNT(*) AS n FROM words').first<{ n: number }>())!.n).toBe(0)
  })

  it('keeps a word once per key, and refuses an empty word, an empty key and alternates that are not JSON', async () => {
    await upgrade()
    await insert('Friend', 'friend')
    await expect(insert('friend', 'friend')).rejects.toThrow()
    await expect(insert('', 'x')).rejects.toThrow()
    await expect(insert('x', '')).rejects.toThrow()
    await expect(insert('y', 'y', 'not json')).rejects.toThrow()
    await insert('z', 'z', '["a"]')
  })
})
