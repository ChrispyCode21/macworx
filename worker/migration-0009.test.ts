// The upgrade from a 0008 database to 0009: `results` gains a nullable `mix` (SPEC §6.8). Rows are tiny stand-ins.
import { convertV4MiniflareOptions, Miniflare } from 'miniflare'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { migrationStatements } from './test/db'

let mf: Miniflare
let db: D1Database
const upTo8 = () => migrationStatements('0008_question_explanations.sql').length
const upgrade = async () => {
  for (const sql of migrationStatements('0009_results_mix.sql').slice(upTo8())) await db.prepare(sql).run()
}
beforeEach(async () => {
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default { fetch() { return new Response("") } }',
      d1Databases: ['DB'],
    }),
  )
  db = (await mf.getD1Database('DB')) as unknown as D1Database
  for (const sql of migrationStatements('0008_question_explanations.sql')) await db.prepare(sql).run()
  await run("INSERT INTO devices (id, key_hash, label, created_at) VALUES (1, 'h1', 'A', 'x')")
  await run("INSERT INTO seeds (seed, device_id, issued_day, used) VALUES (101, 1, 'x', 1), (200, 1, 'x', 0)")
})
afterEach(async () => {
  await mf.dispose()
})

const run = (sql: string) => db.prepare(sql).run()
const rows = async (sql: string) => (await db.prepare(sql).all()).results as Record<string, any>[]
/** The running Worker's INSERT: named columns, nothing about mix. */
const oldInsert = (seed: number) =>
  run(
    `INSERT INTO results (seed, device_id, child_id, day, answers, answered, correct, finished, grade, base,
     accuracy_bonus, streak_bonus, total, created_at) VALUES (${seed}, 1, 1, 'd', '[1]', 20, 18, 1, 'Great', 17, 3, 2, 22, 't')`,
  )

describe('migration 0009', () => {
  it('only adds: every old row keeps every column and reads as the fixed mix (mix NULL)', async () => {
    await oldInsert(101)
    const before = await rows('SELECT * FROM results')
    await upgrade()
    expect(await rows('SELECT * FROM results')).toEqual(before.map((row) => ({ ...row, mix: null })))
  })

  it("still takes the old Worker's INSERT, leaving mix NULL", async () => {
    await upgrade()
    await oldInsert(200)
    expect(await rows('SELECT mix FROM results WHERE seed = 200')).toEqual([{ mix: null }])
  })

  it('stores a mix as JSON text and refuses text that is not JSON', async () => {
    await upgrade()
    await oldInsert(200)
    await run(`UPDATE results SET mix = '[{"operation":"division","level":"easy"}]' WHERE seed = 200`)
    expect(await rows('SELECT mix FROM results')).toEqual([
      { mix: '[{"operation":"division","level":"easy"}]' },
    ])
    await expect(run("UPDATE results SET mix = 'not json' WHERE seed = 200")).rejects.toThrow()
  })
})
