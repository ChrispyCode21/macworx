// The reading assignment (SPEC §5.6, §6.8, §6.10): choosing her next passage, and marking and paying her choices.
// The right answers never leave the Worker before a result is recorded.
import { dayNumber, READING_QUESTIONS, scoreReading } from '../src/engine'
import {
  clampDay,
  readState,
  settleFinished,
  WRITE_ATTEMPTS,
  type ChildRequest,
  type ChildRow,
} from './child'
import { error, isUint32, json, readJson, utcDay } from './http'
import { nextId } from './idFloor'

const MAX_QUESTIONS = 50

/**
 * Her next passage (SPEC §6.10): among the complete ones (1 to 50 questions, and for every question exactly four choices
 * and exactly one right), the lowest id she has no finished result for, else the one whose latest finished result
 * was recorded longest ago (result ids rise in the order the Worker saved them).
 */
const NEXT_PASSAGE = `
  WITH finished AS (
    SELECT a.passage_id, MAX(r.id) AS last_result
    FROM results r JOIN reading_attempts a ON a.id = r.attempt
    WHERE a.child_id = ? AND r.finished = 1
    GROUP BY a.passage_id
  )
  SELECT p.id FROM passages p LEFT JOIN finished f ON f.passage_id = p.id
  WHERE (SELECT COUNT(*) FROM questions q WHERE q.passage_id = p.id) BETWEEN 1 AND ${MAX_QUESTIONS}
    AND NOT EXISTS (
      SELECT 1 FROM questions q WHERE q.passage_id = p.id AND (
        (SELECT COUNT(*) FROM choices c WHERE c.question_id = q.id) <> 4
        OR (SELECT COUNT(*) FROM choices c WHERE c.question_id = q.id AND c.correct = 1) <> 1))
  ORDER BY f.last_result IS NOT NULL, f.last_result, p.id
  LIMIT 1`

interface Passage {
  title: string
  genre: string
  minutes: number
  hint: string
  body: string
  image: string | null
}
interface QuestionRow {
  question_id: number
  qtext: string
  explanation: string
  choice_id: number
  ctext: string
  correct: number
}

/** The passage's questions with their choices, in order, from one join. */
const QUESTIONS = `
  SELECT q.id AS question_id, q.text AS qtext, q.explanation, c.id AS choice_id, c.text AS ctext, c.correct
  FROM questions q JOIN choices c ON c.question_id = q.id
  WHERE q.passage_id = ? ORDER BY q.position, c.position`

function groupQuestions(rows: QuestionRow[]) {
  const questions: {
    id: number
    text: string
    explanation: string
    choices: { id: number; text: string; correct: boolean }[]
  }[] = []
  for (const r of rows) {
    if (questions.at(-1)?.id !== r.question_id)
      questions.push({ id: r.question_id, text: r.qtext, explanation: r.explanation, choices: [] })
    questions.at(-1)!.choices.push({ id: r.choice_id, text: r.ctext, correct: r.correct === 1 })
  }
  return questions
}

/** `count` of `ids` chosen with `random` (numbers from 0 up to, not including, 1), in their original order. */
export function pickQuestions(ids: number[], count: number, random: () => number): number[] {
  if (ids.length <= count) return ids
  const pool = [...ids]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j]!, pool[i]!]
  }
  const chosen = new Set(pool.slice(0, count))
  return ids.filter((id) => chosen.has(id))
}

const randomUnit = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32

/** The questions an attempt carries: the ids stored with it, or all of the passage's when none are (SPEC §6.10). */
const attemptQuestions = <Q extends { id: number }>(all: Q[], stored: string | null) => {
  if (stored === null) return all
  const ids = new Set(JSON.parse(stored) as number[])
  return all.filter((q) => ids.has(q.id))
}

/** POST /api/reading/start: her next passage and an attempt to answer it. */
export async function postReadingStart({ db, device, childId, now }: ChildRequest): Promise<Response> {
  const next = await db.prepare(NEXT_PASSAGE).bind(childId).first<{ id: number }>()
  if (!next) return json(200, { passage: null })

  const [passage, rows] = await db.batch([
    db.prepare('SELECT title, genre, minutes, hint, body, image FROM passages WHERE id = ?').bind(next.id),
    db.prepare(QUESTIONS).bind(next.id),
  ])
  const all = groupQuestions(rows.results as unknown as QuestionRow[])
  const choose = () =>
    all.length > READING_QUESTIONS
      ? JSON.stringify(
          pickQuestions(
            all.map((q) => q.id),
            READING_QUESTIONS,
            randomUnit,
          ),
        )
      : null

  // An attempt she left unchecked is handed out again with its same questions and today as its day (§6.10);
  // otherwise a new one, with its questions chosen now.
  const today = utcDay(now)
  const left = await db
    .prepare(
      'SELECT id, questions FROM reading_attempts WHERE device_id = ? AND child_id = ? AND passage_id = ? AND used = 0 ORDER BY id DESC LIMIT 1',
    )
    .bind(device, childId, next.id)
    .first<{ id: number; questions: string | null }>()
  let attempt: number
  let stored: string | null
  if (left) {
    // Its stored questions stand while every one is still the passage's; one made before the cap has none, and
    // one whose questions were replaced since has some gone: either way they are chosen again now. The write
    // changes them only if nobody has since, so two starts at once agree on one set.
    const present = new Set(all.map((q) => q.id))
    const usable =
      left.questions === null
        ? all.length <= READING_QUESTIONS
        : (JSON.parse(left.questions) as number[]).every((id) => present.has(id))
    const kept = await db
      .prepare(
        `UPDATE reading_attempts SET issued_day = ?, questions = CASE WHEN questions IS ? THEN ? ELSE questions END
         WHERE id = ? RETURNING questions`,
      )
      .bind(today, left.questions, usable ? left.questions : choose(), left.id)
      .first<{ questions: string | null }>()
    stored = kept?.questions ?? null
    attempt = left.id
  } else {
    stored = choose()
    const made = await db
      .prepare(
        `INSERT INTO reading_attempts (id, device_id, child_id, passage_id, issued_day, questions)
         SELECT ${nextId('reading_attempts')}, ?, ?, ?, ?, ?`,
      )
      .bind(device, childId, next.id, today, stored)
      .run()
    attempt = made.meta.last_row_id
  }

  const p = passage.results[0] as unknown as Passage
  return json(200, {
    attempt,
    passage: {
      id: next.id,
      title: p.title,
      genre: p.genre,
      minutes: p.minutes,
      hint: p.hint,
      paragraphs: p.body
        .split(/\n\s*\n/)
        .map((t) => t.trim())
        .filter(Boolean),
      image: p.image,
      // `correct` and `explanation` are left out on purpose: the iPad learns neither before Check.
      questions: attemptQuestions(all, stored).map((q) => ({
        id: q.id,
        text: q.text,
        choices: q.choices.map(({ id, text }) => ({ id, text })),
      })),
    },
  })
}

interface ReadingBody {
  attempt: number
  day: string
  picks: { question: number; choice: number }[]
}

function parseReadingResult(body: unknown): ReadingBody | null {
  if (typeof body !== 'object' || body === null) return null
  const { attempt, day, picks } = body as Record<string, unknown>
  if (!isUint32(attempt) || typeof day !== 'string' || !Array.isArray(picks)) return null
  if (picks.length < 1 || picks.length > MAX_QUESTIONS) return null
  const shaped = picks.every(
    (p) =>
      typeof p === 'object' && p !== null && isUint32((p as any).question) && isUint32((p as any).choice),
  )
  if (!shaped) return null
  try {
    dayNumber(day)
  } catch {
    return null
  }
  return { attempt, day, picks }
}

interface StoredReading {
  day: string
  answered: number
  correct: number
  finished: number
  grade: string | null
  base: number
  accuracy_bonus: number
  streak_bonus: number
  total: number
  detail: string
}

/** What the result of a reading assignment shows: the totals, and per question whether she was right (SPEC §8). */
function toReadingResult(attempt: number, row: StoredReading) {
  const detail = JSON.parse(row.detail) as {
    questions: { id: number; picked: number; right: number; explanation?: string }[]
  }
  return {
    attempt,
    day: row.day,
    answered: row.answered,
    correct: row.correct,
    finished: row.finished === 1,
    grade: row.grade,
    payout: {
      base: row.base,
      accuracyBonus: row.accuracy_bonus,
      streakBonus: row.streak_bonus,
      total: row.total,
    },
    questions: detail.questions.map((q) => ({
      id: q.id,
      right: q.picked === q.right,
      rightChoice: q.right,
      explanation: q.explanation ?? '',
    })),
  }
}

const findReading = (db: D1Database, attempt: number) =>
  db.prepare('SELECT * FROM results WHERE attempt = ?').bind(attempt).first<StoredReading>()

/** POST /api/reading/result { attempt, day, picks } (SPEC §6.8). */
export async function postReadingResult({
  request,
  db,
  device,
  childId,
  now,
}: ChildRequest): Promise<Response> {
  const body = parseReadingResult(await readJson(request))
  if (!body) return error(400, 'bad_result')

  const attempt = await db
    .prepare(
      'SELECT device_id, child_id, passage_id, issued_day, questions FROM reading_attempts WHERE id = ?',
    )
    .bind(body.attempt)
    .first<{
      device_id: number
      child_id: number
      passage_id: number
      issued_day: string
      questions: string | null
    }>()
  if (!attempt || attempt.device_id !== device || attempt.child_id !== childId)
    return error(404, 'unknown_attempt')

  const recorded = await findReading(db, body.attempt)
  if (recorded) {
    return json(200, {
      result: toReadingResult(body.attempt, recorded),
      state: await readState(db, device, childId),
    })
  }

  const [title, rows] = await db.batch([
    db.prepare('SELECT title FROM passages WHERE id = ?').bind(attempt.passage_id),
    db.prepare(QUESTIONS).bind(attempt.passage_id),
  ])
  const questions = attemptQuestions(
    groupQuestions(rows.results as unknown as QuestionRow[]),
    attempt.questions,
  )
  // Every question exactly once, each choice one of that question's (nothing is recorded otherwise).
  const picked = new Map<number, number>()
  for (const { question, choice } of body.picks) picked.set(question, choice)
  const valid =
    body.picks.length === questions.length &&
    picked.size === questions.length &&
    questions.every((q) => q.choices.some((c) => c.id === picked.get(q.id)))
  if (!valid) return error(400, 'bad_picks')

  const rightChoices = questions.map((q) => q.choices.find((c) => c.correct)?.id ?? -1)
  const pickedChoices = questions.map((q) => picked.get(q.id)!)
  const correct = scoreReading(rightChoices, pickedChoices)
  const size = questions.length
  const day = clampDay(body.day, attempt.issued_day, now)
  const clockWrong = day !== body.day
  // The passage as it is now, kept with the result so a later edit can't change it (SPEC §6.8, D14).
  const detail = JSON.stringify({
    title: (title.results[0] as unknown as { title: string }).title,
    questions: questions.map((q, i) => ({
      id: q.id,
      text: q.text,
      explanation: q.explanation,
      choices: q.choices.map(({ id, text }) => ({ id, text })),
      picked: pickedChoices[i],
      right: rightChoices[i],
    })),
  })

  for (let tries = 0; tries < WRITE_ATTEMPTS; tries++) {
    const child = await db
      .prepare('SELECT balance, streak, last_day, completed, revision FROM children WHERE id = ?')
      .bind(childId)
      .first<ChildRow>()
    if (!child) return error(500, 'no_child')
    const { earned, streak, lastDay, gradeLabel } = settleFinished({ child, day, clockWrong, correct, size })

    // The same one-transaction write as a math result: the child update applies only if nobody wrote since we
    // read, and the other two statements apply only if it did.
    const revision = crypto.randomUUID()
    const [update] = await db.batch([
      db
        .prepare(
          `UPDATE children SET balance = balance + ?, completed = completed + 1, streak = ?, last_day = ?,
           revision = ? WHERE id = ? AND revision = ? AND NOT EXISTS (SELECT 1 FROM results WHERE attempt = ?)
           AND EXISTS (SELECT 1 FROM devices WHERE id = ? AND revoked_at IS NULL)
           AND EXISTS (SELECT 1 FROM reading_attempts WHERE id = ? AND used = 0)`,
        )
        .bind(
          earned.total,
          streak,
          lastDay,
          revision,
          childId,
          child.revision,
          body.attempt,
          device,
          body.attempt,
        ),
      db
        .prepare(
          `INSERT INTO results (kind, attempt, detail, device_id, child_id, day, answers, answered, correct, finished,
           grade, base, accuracy_bonus, streak_bonus, total, created_at)
           SELECT 'reading', ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ? WHERE (SELECT revision FROM children WHERE id = ?) = ?
           AND NOT EXISTS (SELECT 1 FROM results WHERE attempt = ?)
           AND EXISTS (SELECT 1 FROM reading_attempts WHERE id = ? AND used = 0)`,
        )
        .bind(
          body.attempt,
          detail,
          device,
          childId,
          day,
          JSON.stringify(pickedChoices),
          size,
          correct,
          gradeLabel,
          earned.base,
          earned.accuracyBonus,
          earned.streakBonus,
          earned.total,
          now.toISOString(),
          childId,
          revision,
          body.attempt,
          body.attempt,
        ),
      db
        .prepare(
          'UPDATE reading_attempts SET used = 1 WHERE id = ? AND (SELECT revision FROM children WHERE id = ?) = ?',
        )
        .bind(body.attempt, childId, revision),
    ])
    if (update.meta.changes === 1) {
      const saved = await findReading(db, body.attempt)
      return json(201, {
        result: toReadingResult(body.attempt, saved!),
        state: await readState(db, device, childId),
      })
    }
    // Someone else wrote first; if it was this same result, return it instead of recording it twice.
    const raced = await findReading(db, body.attempt)
    if (raced)
      return json(200, {
        result: toReadingResult(body.attempt, raced),
        state: await readState(db, device, childId),
      })
    // Or the iPad was unpaired while this upload was on its way: refused like any later request (§6.9).
    const active = await db
      .prepare('SELECT 1 AS ok FROM devices WHERE id = ? AND revoked_at IS NULL')
      .bind(device)
      .first()
    if (!active) return error(401, 'unauthorized')
    // A parent edited the passage while this was on its way, so the attempt is gone (SPEC §6.10).
    const stillThere = await db
      .prepare('SELECT 1 AS ok FROM reading_attempts WHERE id = ?')
      .bind(body.attempt)
      .first()
    if (!stillThere) return error(404, 'unknown_attempt')
  }
  return error(503, 'busy')
}
