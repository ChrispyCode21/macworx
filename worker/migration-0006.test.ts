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
  for (const sql of migrationStatements()) await db.prepare(sql).run()
  await db.prepare("INSERT INTO passages (id, title, minutes, body) VALUES (1, 'A', 1, 'Text.')").run()
  await db.prepare("INSERT INTO questions (id, passage_id, position, text) VALUES (1, 1, 1, 'Q?')").run()
})
afterEach(async () => {
  await mf.dispose()
})

const run = (sql: string) => db.prepare(sql).run()
const choice = (id: number, position: number, correct: number) =>
  run(
    `INSERT INTO choices (id, question_id, position, text, correct) VALUES (${id}, 1, ${position}, 'c', ${correct})`,
  )

describe('migration 0006', () => {
  it('stores a passage with no picture, genre or hint, and with a picture name', async () => {
    const row = await db.prepare('SELECT genre, hint, image FROM passages WHERE id = 1').first()
    expect(row).toEqual({ genre: '', hint: '', image: null })
    await run("INSERT INTO passages (id, title, minutes, body, image) VALUES (2, 'B', 1, 'Text.', '2.webp')")
    expect((await db.prepare('SELECT image FROM passages WHERE id = 2').first())!.image).toBe('2.webp')
  })

  it('refuses a passage with no title, no text, no minutes or an empty picture name', async () => {
    await expect(
      run("INSERT INTO passages (id, title, minutes, body) VALUES (2, '', 1, 'x')"),
    ).rejects.toThrow()
    await expect(
      run("INSERT INTO passages (id, title, minutes, body) VALUES (2, 'B', 1, '')"),
    ).rejects.toThrow()
    await expect(
      run("INSERT INTO passages (id, title, minutes, body) VALUES (2, 'B', 0, 'x')"),
    ).rejects.toThrow()
    await expect(
      run("INSERT INTO passages (id, title, minutes, body, image) VALUES (2, 'B', 1, 'x', '')"),
    ).rejects.toThrow()
  })

  it('allows one right choice per question and refuses a second', async () => {
    await choice(1, 1, 1)
    await choice(2, 2, 0)
    await expect(choice(3, 3, 1)).rejects.toThrow()
  })

  it('allows several wrong choices and none right (the seed script checks completeness)', async () => {
    await choice(1, 1, 0)
    await choice(2, 2, 0)
    expect((await db.prepare('SELECT count(*) AS n FROM choices').first())!.n).toBe(2)
  })

  it('refuses a repeated or out-of-range position', async () => {
    await choice(1, 1, 0)
    await expect(choice(2, 1, 0)).rejects.toThrow()
    await expect(choice(3, 5, 0)).rejects.toThrow()
    await expect(choice(4, 0, 0)).rejects.toThrow()
    await expect(
      run("INSERT INTO questions (id, passage_id, position, text) VALUES (2, 1, 1, 'Q?')"),
    ).rejects.toThrow()
  })

  it('refuses empty question and choice text', async () => {
    await expect(
      run("INSERT INTO questions (id, passage_id, position, text) VALUES (2, 1, 2, '')"),
    ).rejects.toThrow()
    await expect(
      run("INSERT INTO choices (id, question_id, position, text) VALUES (1, 1, 1, '')"),
    ).rejects.toThrow()
  })

  it('refuses a question of no passage and a choice of no question', async () => {
    await expect(
      run("INSERT INTO questions (id, passage_id, position, text) VALUES (2, 99, 1, 'Q?')"),
    ).rejects.toThrow()
    await expect(
      run("INSERT INTO choices (id, question_id, position, text) VALUES (1, 99, 1, 'c')"),
    ).rejects.toThrow()
  })

  it('refuses to delete a passage that has questions, or a question that has choices', async () => {
    await choice(1, 1, 1)
    await expect(run('DELETE FROM passages WHERE id = 1')).rejects.toThrow()
    await expect(run('DELETE FROM questions WHERE id = 1')).rejects.toThrow()
  })

  it('leaves the earlier tables as they were', async () => {
    const tables = await db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '\\_%' ESCAPE '\\' ORDER BY name",
      )
      .all()
    const names = tables.results.map((r) => (r as { name: string }).name)
    for (const t of ['child', 'children', 'devices', 'seeds', 'results', 'admin_log', 'pairing_codes'])
      expect(names).toContain(t)
  })
})
