// Adding, listing, editing and deleting reading passages from the parent portal (SPEC §6.10, §8). The checks are the engine's, the same ones the
// portal ran before sending it; this is the second look.
import { checkPassage, tooLong } from '../src/engine'
import type { CheckedPassage } from '../src/engine'
import { error, json } from './http'
import { nextId, raiseFloor } from './idFloor'
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
function storeQuestions(db: D1Database, id: number, p: CheckedPassage) {
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

/** The statements that store a new passage: its row, then its questions and choices. */
const storePassage = (db: D1Database, id: number, p: CheckedPassage) => [
  db
    .prepare(
      'INSERT INTO passages (id, title, genre, minutes, hint, body, source) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .bind(id, p.title, p.genre, p.minutes, p.hint, p.paragraphs.join('\n\n'), JSON.stringify(p.source)),
  ...storeQuestions(db, id, p),
]

/** The checked passage in a `{ passage }` request body, or the 400 to answer with. */
async function readPassage(request: Request): Promise<CheckedPassage | Response> {
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
  return checked.ok ? checked.passage : bad(checked.problems)
}

/** POST /api/parent/passages { passage }: checks the pasted passage and saves it whole, or saves nothing. */
export async function postPassage({ request, db }: ParentRequest): Promise<Response> {
  const passage = await readPassage(request)
  if (passage instanceof Response) return passage

  // The next free id. Two saves at once can pick the same one; the second fails whole on the primary key and
  // tries again with a fresh id.
  for (let tries = 0; tries < WRITE_ATTEMPTS; tries++) {
    const next = await db
      // Past the highest id ever given, not just the highest left: a removed id is never reused (SPEC §6.10).
      .prepare(`SELECT ${nextId('passages')} AS id`)
      .first<{ id: number }>()
    const id = next!.id
    try {
      await db.batch(storePassage(db, id, passage))
      return json(201, { id })
    } catch (e) {
      // Only a clash on the id is worth another look; anything else is a fault, not a busy Worker.
      if (!/UNIQUE|PRIMARY KEY/i.test(String(e))) throw e
    }
  }
  return json(503, { error: 'busy' })
}

/** GET /api/parent/passages: every passage with what the list shows (SPEC §5.3): its questions and times read. */
export async function listPassages({ db }: ParentRequest): Promise<Response> {
  const { results } = await db
    .prepare(
      `SELECT p.id, p.title, p.minutes,
         (SELECT COUNT(*) FROM questions q WHERE q.passage_id = p.id) AS questions,
         (SELECT COUNT(*) FROM results r JOIN reading_attempts a ON a.id = r.attempt
           WHERE a.passage_id = p.id AND r.finished = 1) AS times_read
       FROM passages p ORDER BY p.id`,
    )
    .all<{ id: number; title: string; minutes: number; questions: number; times_read: number }>()
  return json(200, {
    passages: results.map(({ times_read, ...rest }) => ({ ...rest, timesRead: times_read })),
  })
}

interface StoredRow {
  qid: number
  position: number
  text: string
  explanation: string
  choice: string
  correct: number
}

/** The passage's questions as stored: choices in their stored (shuffled) order. */
async function storedQuestions(db: D1Database, id: number) {
  const { results } = await db
    .prepare(
      `SELECT q.id AS qid, q.position, q.text, q.explanation, c.text AS choice, c.correct
       FROM questions q JOIN choices c ON c.question_id = q.id
       WHERE q.passage_id = ? ORDER BY q.position, c.position`,
    )
    .bind(id)
    .all<StoredRow>()
  // Grouped by question id, so a gap in the positions (a passage added by hand) can't break it.
  const byId = new Map<number, { text: string; explanation: string; options: string[]; right: string }>()
  for (const r of results) {
    let q = byId.get(r.qid)
    if (!q) byId.set(r.qid, (q = { text: r.text, explanation: r.explanation, options: [], right: '' }))
    q.options.push(r.choice)
    if (r.correct === 1) q.right = r.choice
  }
  return [...byId.values()]
}

/** GET /api/parent/passages/:id: the JSON for the Content screen's box (SPEC §5.3), or 404. */
export async function getPassage({ db, params }: ParentRequest): Promise<Response> {
  const id = Number(params.id)
  const row = await db
    .prepare('SELECT title, genre, minutes, hint, body, source FROM passages WHERE id = ?')
    .bind(id)
    .first<{
      title: string
      genre: string
      minutes: number
      hint: string
      body: string
      source: string | null
    }>()
  if (!row) return error(404, 'unknown_passage')
  // The JSON as it was pasted when there is one, with every field in it; a passage added by hand is rebuilt.
  if (row.source !== null) {
    try {
      return json(200, { passage: JSON.parse(row.source) })
    } catch {
      // Fall through to the rebuilt one.
    }
  }
  const questions = await storedQuestions(db, id)
  return json(200, {
    passage: {
      title: row.title,
      minutes: row.minutes,
      ...(row.genre ? { topic: row.genre } : {}),
      ...(row.hint ? { hint: row.hint } : {}),
      passage: row.body
        .split(/\n\s*\n/)
        .map((t) => t.trim())
        .filter(Boolean),
      questions: questions.map((q) => ({
        question: q.text,
        options: q.options,
        correct_answer: q.right,
        ...(q.explanation ? { explanation: q.explanation } : {}),
      })),
    },
  })
}

/** The questions are the same when each has the same text, explanation, right choice and set of choices. */
function sameQuestions(
  stored: Awaited<ReturnType<typeof storedQuestions>>,
  next: CheckedPassage['questions'],
): boolean {
  if (stored.length !== next.length) return false
  const form = (text: string, explanation: string, options: string[], right: string) =>
    JSON.stringify([text, explanation, [...options].sort(), right])
  return stored.every(
    (q, i) =>
      form(q.text, q.explanation, q.options, q.right) ===
      form(next[i]!.text, next[i]!.explanation, next[i]!.options, next[i]!.options[next[i]!.answer]!),
  )
}

/**
 * PUT /api/parent/passages/:id { passage }: the same checks as a new passage, then it replaces the passage (SPEC §6.10).
 * Its picture stays. When the questions changed, her unchecked attempts are removed in the same batch, so her next
 * start is the edited passage; when they didn't, nothing about her attempts or the choices' order changes.
 */
export async function putPassage({ request, db, params }: ParentRequest): Promise<Response> {
  const id = Number(params.id)
  const passage = await readPassage(request)
  if (passage instanceof Response) return passage
  const exists = await db.prepare('SELECT 1 AS ok FROM passages WHERE id = ?').bind(id).first()
  if (!exists) return error(404, 'unknown_passage')

  const same = sameQuestions(await storedQuestions(db, id), passage.questions)
  const statements = [
    db
      .prepare(
        'UPDATE passages SET title = ?, genre = ?, minutes = ?, hint = ?, body = ?, source = ? WHERE id = ?',
      )
      .bind(
        passage.title,
        passage.genre,
        passage.minutes,
        passage.hint,
        passage.paragraphs.join('\n\n'),
        JSON.stringify(passage.source),
        id,
      ),
  ]
  if (!same)
    statements.push(
      raiseFloor(db, 'reading_attempts', 'passage_id = ? AND used = 0', id),
      db.prepare('DELETE FROM reading_attempts WHERE passage_id = ? AND used = 0').bind(id),
      db
        .prepare('DELETE FROM choices WHERE question_id IN (SELECT id FROM questions WHERE passage_id = ?)')
        .bind(id),
      db.prepare('DELETE FROM questions WHERE passage_id = ?').bind(id),
      ...storeQuestions(db, id, passage),
    )
  try {
    const [updated] = await db.batch(statements)
    if (updated!.meta.changes === 0) return error(404, 'unknown_passage')
  } catch (e) {
    // The passage was deleted between the look above and the write: the whole batch was undone.
    if (/FOREIGN KEY/i.test(String(e))) return error(404, 'unknown_passage')
    throw e
  }
  return json(200, { id })
}

/** True while no result points, through an attempt, at the passage that the next `?` binds. */
const NO_RESULT =
  'NOT EXISTS (SELECT 1 FROM results r JOIN reading_attempts a ON a.id = r.attempt WHERE a.passage_id = ?)'

/**
 * DELETE /api/parent/passages/:id: refused (409) once the passage has a recorded result. Otherwise its questions,
 * choices, attempts and picture go together; each statement checks again that no result exists, so a result recorded
 * at the same moment wins and nothing is half-deleted.
 */
export async function deletePassage({ db, params, bucket }: ParentRequest): Promise<Response> {
  const id = Number(params.id)
  const row = await db
    .prepare('SELECT image FROM passages WHERE id = ?')
    .bind(id)
    .first<{ image: string | null }>()
  if (!row) return error(404, 'unknown_passage')
  const done = await db.batch([
    raiseFloor(db, 'reading_attempts', `passage_id = ? AND ${NO_RESULT}`, id, id),
    raiseFloor(db, 'passages', `id = ? AND ${NO_RESULT}`, id, id),
    db
      .prepare(
        `DELETE FROM choices WHERE question_id IN (SELECT id FROM questions WHERE passage_id = ?) AND ${NO_RESULT}`,
      )
      .bind(id, id),
    db.prepare(`DELETE FROM questions WHERE passage_id = ? AND ${NO_RESULT}`).bind(id, id),
    db.prepare(`DELETE FROM reading_attempts WHERE passage_id = ? AND ${NO_RESULT}`).bind(id, id),
    db.prepare(`DELETE FROM passages WHERE id = ? AND ${NO_RESULT}`).bind(id, id),
  ])
  if (done[done.length - 1]!.meta.changes === 0) {
    const still = await db.prepare('SELECT 1 AS ok FROM passages WHERE id = ?').bind(id).first()
    return still ? error(409, 'has_results') : error(404, 'unknown_passage')
  }
  // The picture goes with it. A failure here leaves a file nobody can reach, which is not the parent's problem.
  if (row.image && bucket) {
    try {
      await bucket.delete(row.image)
    } catch (e) {
      console.error(e)
    }
  }
  return json(200, { ok: true })
}
