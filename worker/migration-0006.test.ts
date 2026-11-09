// Migration 0006: the reading passage tables (SPEC §6.10). The rows here are tiny stand-ins, not content.
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
  await run("INSERT INTO passages (id, title, minutes, body) VALUES (1, 'A', 1, 'Text.')")
  await run("INSERT INTO questions (id, passage_id, position, text) VALUES (1, 1, 1, 'Q?')")
})
afterEach(async () => {
  await mf.dispose()
})

const run = (sql: string) => db.prepare(sql).run()
const choice = (id: number, position: number, correct: number, question = 1) =>
  run(
    `INSERT INTO choices (id, question_id, position, text, correct) VALUES (${id}, ${question}, ${position}, 'c', ${correct})`,
  )

describe('migration 0006', () => {
  it('allows one right choice per question, and each question and passage has its own', async () => {
    await choice(1, 1, 1)
    await expect(choice(2, 2, 1)).rejects.toThrow()
    await run("INSERT INTO questions (id, passage_id, position, text) VALUES (2, 1, 2, 'Q2?')")
    for (let position = 1; position <= 4; position++)
      await choice(10 + position, position, position === 2 ? 1 : 0, 2)
    await run("INSERT INTO passages (id, title, minutes, body) VALUES (2, 'B', 1, 'Text.')")
    await run("INSERT INTO questions (id, passage_id, position, text) VALUES (3, 2, 1, 'Q?')")
    await choice(21, 1, 1, 3)
  })

  it('names a picture after its own passage', async () => {
    for (const image of ['', '7.webp', '12.webp', '1', 'x1.webp'])
      await expect(
        run(`INSERT INTO passages (id, title, minutes, body, image) VALUES (2, 'B', 1, 'x', '${image}')`),
      ).rejects.toThrow()
    await run("INSERT INTO passages (id, title, minutes, body, image) VALUES (2, 'B', 1, 'x', '2.png')")
    await run("INSERT INTO passages (id, title, minutes, body, image) VALUES (12, 'B', 1, 'x', '12.webp')")
  })

  it('refuses to delete a passage that has questions, or a question that has choices', async () => {
    await choice(1, 1, 1)
    await expect(run('DELETE FROM passages WHERE id = 1')).rejects.toThrow()
    await expect(run('DELETE FROM questions WHERE id = 1')).rejects.toThrow()
  })
})
