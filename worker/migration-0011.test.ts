// The upgrade from a 0010 database to 0011: `passages` gains a nullable `source` (SPEC §6.10).
import { convertV4MiniflareOptions, Miniflare } from 'miniflare'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { migrationStatements } from './test/db'

let mf: Miniflare
let db: D1Database
const upTo10 = () => migrationStatements('0010_reading_attempt_questions.sql').length
const upgrade = async () => {
  for (const sql of migrationStatements().slice(upTo10())) await db.prepare(sql).run()
}
const run = (sql: string) => db.prepare(sql).run()
const rows = async (sql: string) => (await db.prepare(sql).all()).results as Record<string, any>[]
/** The INSERT of the hand-run script and the old Worker: named columns, nothing about source. */
const oldInsert = () => run("INSERT INTO passages (id, title, minutes, body) VALUES (1, 'S', 1, 'One.')")

beforeEach(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default { fetch() { return new Response("") } }',
      d1Databases: ['DB'],
    }),
  )
  db = (await mf.getD1Database('DB')) as unknown as D1Database
  for (const sql of migrationStatements('0010_reading_attempt_questions.sql')) await db.prepare(sql).run()
})
afterEach(async () => {
  await mf.dispose()
})

describe('migration 0011', () => {
  it('only adds: an old passage keeps every column and has no source (NULL)', async () => {
    await oldInsert()
    const before = await rows('SELECT * FROM passages')
    await upgrade()
    expect(await rows('SELECT * FROM passages')).toEqual(before.map((row) => ({ ...row, source: null })))
  })

  it('still takes the old INSERT, and stores the pasted JSON as text', async () => {
    await upgrade()
    await oldInsert()
    await run(`UPDATE passages SET source = '{"title":"S"}'`)
    expect(await rows('SELECT source FROM passages')).toEqual([{ source: '{"title":"S"}' }])
  })
})
