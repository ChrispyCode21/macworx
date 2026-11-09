// Migration 0006: the reading passage tables (SPEC §6.10). The rows here are tiny stand-ins, not content.
import { convertV4MiniflareOptions, Miniflare } from 'miniflare'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { migrationStatements } from './test/db'

let mf: Miniflare
let db: D1Database
const open = async (upTo?: string) => {
  const m = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: 'export default { fetch() { return new Response("") } }',
      d1Databases: ['DB'],
    }),
  )
  const d = (await m.getD1Database('DB')) as unknown as D1Database
  for (const sql of migrationStatements(upTo)) await d.prepare(sql).run()
  return { m, d }
}
beforeEach(async () => {
  ;({ m: mf, d: db } = await open())
  await db.prepare("INSERT INTO passages (id, title, minutes, body) VALUES (1, 'A', 1, 'Text.')").run()
  await db.prepare("INSERT INTO questions (id, passage_id, position, text) VALUES (1, 1, 1, 'Q?')").run()
})
afterEach(async () => {
  await mf.dispose()
})

const run = (sql: string) => db.prepare(sql).run()
const count = async (table: string) =>
  ((await db.prepare(`SELECT count(*) AS n FROM ${table}`).first()) as { n: number }).n
const choice = (id: number, position: number, correct: number, question = 1) =>
  run(
    `INSERT INTO choices (id, question_id, position, text, correct) VALUES (${id}, ${question}, ${position}, 'c', ${correct})`,
  )

describe('migration 0006', () => {
  it('stores a passage with no picture, genre or hint, and with its own picture name', async () => {
    expect(await db.prepare('SELECT genre, hint, image FROM passages WHERE id = 1').first()).toEqual({
      genre: '',
      hint: '',
      image: null,
    })
    await run("INSERT INTO passages (id, title, minutes, body, image) VALUES (3, 'B', 1, 'Text.', '3.webp')")
    expect(
      ((await db.prepare('SELECT image FROM passages WHERE id = 3').first()) as { image: string }).image,
    ).toBe('3.webp')
  })

  it('refuses a passage with no title, no text, too few minutes or no minutes', async () => {
    await expect(
      run("INSERT INTO passages (id, title, minutes, body) VALUES (2, '', 1, 'x')"),
    ).rejects.toThrow()
    await expect(
      run("INSERT INTO passages (id, title, minutes, body) VALUES (2, 'B', 1, '')"),
    ).rejects.toThrow()
    await expect(
      run("INSERT INTO passages (id, title, minutes, body) VALUES (2, 'B', 0, 'x')"),
    ).rejects.toThrow()
    await expect(run("INSERT INTO passages (id, title, body) VALUES (2, 'B', 'x')")).rejects.toThrow()
  })

  it('refuses a null genre or hint, and a picture that is not named after its passage', async () => {
    await expect(
      run("INSERT INTO passages (id, title, minutes, body, genre) VALUES (2, 'B', 1, 'x', NULL)"),
    ).rejects.toThrow()
    await expect(
      run("INSERT INTO passages (id, title, minutes, body, hint) VALUES (2, 'B', 1, 'x', NULL)"),
    ).rejects.toThrow()
    for (const image of ['', '7.webp', '12.webp', '2', 'x2.webp'])
      await expect(
        run(`INSERT INTO passages (id, title, minutes, body, image) VALUES (2, 'B', 1, 'x', '${image}')`),
      ).rejects.toThrow()
    await run("INSERT INTO passages (id, title, minutes, body, image) VALUES (2, 'B', 1, 'x', '2.png')")
    await run("INSERT INTO passages (id, title, minutes, body, image) VALUES (12, 'B', 1, 'x', '12.webp')")
  })

  it('allows one right choice per question and refuses a second', async () => {
    await choice(1, 1, 1)
    await choice(2, 2, 0)
    await expect(choice(3, 3, 1)).rejects.toThrow()
  })

  it('scopes the rules to a question and a passage: a second one may repeat positions and have its own right choice', async () => {
    await choice(1, 1, 1)
    await run("INSERT INTO questions (id, passage_id, position, text) VALUES (2, 1, 2, 'Q2?')")
    for (let position = 1; position <= 4; position++)
      await choice(10 + position, position, position === 2 ? 1 : 0, 2)
    await run("INSERT INTO passages (id, title, minutes, body) VALUES (2, 'B', 1, 'Text.')")
    await run("INSERT INTO questions (id, passage_id, position, text) VALUES (3, 2, 1, 'Q?')")
    await choice(21, 1, 1, 3)
    expect(await count('choices')).toBe(6)
    expect(await count('questions')).toBe(3)
  })

  it('allows several wrong choices and none right (the seed script checks completeness)', async () => {
    await choice(1, 1, 0)
    await choice(2, 2, 0)
    expect(await count('choices')).toBe(2)
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

  it('adds the three tables and the index and changes nothing that was there', async () => {
    const schema = async (d: D1Database) =>
      (
        await d
          .prepare("SELECT name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY name")
          .all()
      ).results as { name: string; sql: string }[]
    const { m, d } = await open('0005_children_state.sql')
    try {
      const before = await schema(d)
      const added = new Set(['passages', 'questions', 'choices', 'choices_one_correct'])
      const after = (await schema(db)).filter((r) => !added.has(r.name))
      expect(after).toEqual(before)
      expect((await schema(db)).filter((r) => added.has(r.name))).toHaveLength(4)
    } finally {
      await m.dispose()
    }
  })
})
