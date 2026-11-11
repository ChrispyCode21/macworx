// The upgrade from a 0009 database to 0010: `reading_attempts` gains a nullable `questions` (SPEC §6.10).
import { convertV4MiniflareOptions, Miniflare } from 'miniflare'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { migrationStatements } from './test/db'

let mf: Miniflare
let db: D1Database
const upTo9 = () => migrationStatements('0009_results_mix.sql').length
const upgrade = async () => {
  for (const sql of migrationStatements().slice(upTo9())) await db.prepare(sql).run()
}
const run = (sql: string) => db.prepare(sql).run()
const rows = async (sql: string) => (await db.prepare(sql).all()).results as Record<string, any>[]
/** The running Worker's INSERT: named columns, nothing about questions. */
const oldInsert = () =>
  run("INSERT INTO reading_attempts (device_id, child_id, passage_id, issued_day) VALUES (1, 1, 1, 'd')")

beforeEach(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default { fetch() { return new Response("") } }',
      d1Databases: ['DB'],
    }),
  )
  db = (await mf.getD1Database('DB')) as unknown as D1Database
  for (const sql of migrationStatements('0009_results_mix.sql')) await db.prepare(sql).run()
  await run("INSERT INTO devices (id, key_hash, label, created_at) VALUES (1, 'h1', 'A', 'x')")
  await run("INSERT INTO passages (id, title, minutes, body) VALUES (1, 'S', 1, 'One.')")
})
afterEach(async () => {
  await mf.dispose()
})

describe('migration 0010', () => {
  it('only adds: an old attempt keeps every column and reads as all questions (questions NULL)', async () => {
    await oldInsert()
    const before = await rows('SELECT * FROM reading_attempts')
    await upgrade()
    expect(await rows('SELECT * FROM reading_attempts')).toEqual(
      before.map((row) => ({ ...row, questions: null })),
    )
  })

  it("still takes the old Worker's INSERT, leaving questions NULL, and stores ids as text", async () => {
    await upgrade()
    await oldInsert()
    await run("UPDATE reading_attempts SET questions = '[101,102]'")
    expect(await rows('SELECT questions FROM reading_attempts')).toEqual([{ questions: '[101,102]' }])
  })
})
