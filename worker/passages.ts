// Adding a reading passage from the parent portal (SPEC §6.10, §8). The checks are the engine's, the same ones the
// portal ran before sending it; this is the second look.
import { checkPassage, tooLong } from '../src/engine'
import type { CheckedPassage } from '../src/engine'
import { json } from './http'
import { nextId } from './idFloor'
import type { ParentRequest } from './parent-request'

const WRITE_ATTEMPTS = 3

/** The most characters of request body that are read at all. */
const MAX_BODY = 1_000_000

const bad = (problems: string[]) => json(400, { error: 'bad_passage', problems })

/** `items` in a random order (Fisher-Yates, crypto randomness). */
function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items]
  const rand = new Uint32Array(1)
  for (let i = out.length - 1; i > 0; i--) {
    crypto.getRandomValues(rand)
    const j = Math.floor((rand[0]! / 2 ** 32) * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/**
 * The statements that store a passage under `id`: the passage, its questions, then its choices, each question's
 * choices shuffled once here. Ids follow scripts/passage-sql.mjs: a question's is the passage's times 100 plus its
 * position, a choice's is its question's times 10 plus its position. Rows go in through `json_each`, so a passage
 * of 50 questions is still three statements (D1 allows 100 bound values a statement).
 */
function storePassage(db: D1Database, id: number, p: CheckedPassage) {
  const questions = p.questions.map((q, i) => ({
    id: id * 100 + i + 1,
    position: i + 1,
    text: q.text,
    explanation: q.explanation,
  }))
  const choices = p.questions.flatMap((q, i) =>
    shuffled(q.options.map((text, index) => ({ text, right: index === q.answer }))).map((c, position) => ({
      id: (id * 100 + i + 1) * 10 + position + 1,
      question: id * 100 + i + 1,
      position: position + 1,
      text: c.text,
      correct: c.right ? 1 : 0,
    })),
  )
  return [
    db
      .prepare(
        'INSERT INTO passages (id, title, genre, minutes, hint, body, source) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(id, p.title, p.genre, p.minutes, p.hint, p.paragraphs.join('\n\n'), JSON.stringify(p.source)),
    db
      .prepare(
        `INSERT INTO questions (id, passage_id, position, text, explanation)
         SELECT json_extract(value, '$.id'), ?, json_extract(value, '$.position'), json_extract(value, '$.text'),
           json_extract(value, '$.explanation') FROM json_each(?)`,
      )
      .bind(id, JSON.stringify(questions)),
    db
      .prepare(
        `INSERT INTO choices (id, question_id, position, text, correct)
         SELECT json_extract(value, '$.id'), json_extract(value, '$.question'), json_extract(value, '$.position'),
           json_extract(value, '$.text'), json_extract(value, '$.correct') FROM json_each(?)`,
      )
      .bind(JSON.stringify(choices)),
  ]
}

/** POST /api/parent/passages { passage }: checks the pasted passage and saves it whole, or saves nothing. */
export async function postPassage({ request, db }: ParentRequest): Promise<Response> {
  // The limit counts the passage as compact JSON (`tooLong`, below), whatever the request's own spacing. This
  // larger cap only stops the Worker parsing a body that could not be a passage however it is indented.
  const raw = await request.text()
  if (raw.length > MAX_BODY) return bad(['That is too long to be one passage (the limit is 64 KB).'])
  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return bad(['The request has to be JSON like { "passage": { … } }.'])
  }
  if (typeof body !== 'object' || body === null || !('passage' in body))
    return bad(['The request has to be JSON like { "passage": { … } }.'])
  const pasted = (body as { passage: unknown }).passage
  if (tooLong(pasted)) return bad(['That is too long to be one passage (the limit is 64 KB).'])

  const checked = checkPassage(pasted)
  if (!checked.ok) return bad(checked.problems)

  // The next free id. Two saves at once can pick the same one; the second fails whole on the primary key and
  // tries again with a fresh id.
  for (let tries = 0; tries < WRITE_ATTEMPTS; tries++) {
    const next = await db
      // Past the highest id ever given, not just the highest left: a removed id is never reused (SPEC §6.10).
      .prepare(`SELECT ${nextId('passages')} AS id`)
      .first<{ id: number }>()
    const id = next!.id
    try {
      await db.batch(storePassage(db, id, checked.passage))
      return json(201, { id })
    } catch (e) {
      // Only a clash on the id is worth another look; anything else is a fault, not a busy Worker.
      if (!/UNIQUE|PRIMARY KEY/i.test(String(e))) throw e
    }
  }
  return json(503, { error: 'busy' })
}
