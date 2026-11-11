// The spelling assignment (SPEC §5.7, §6.8, §6.11): choosing her next words, and marking and paying her typing.
// Unlike reading, the words and their alternates go to the iPad before she answers, because it says each word and
// marks it as she goes; this Worker still marks every word again and decides what she earned.
import { checkSpelling, dayNumber, scoreSpelling, SPELLING, spellingPayout } from '../src/engine'
import {
  clampDay,
  readState,
  settleFinished,
  WRITE_ATTEMPTS,
  type ChildRequest,
  type ChildRow,
} from './child'
import { error, isUint32, json, readJson, utcDay } from './http'

/** The longest typing a result may carry: more than any word or alternate, so only a mistake or a trick is refused. */

/**
 * Her next words (SPEC §6.11): the words she has no finished result for, lowest id first, then the words whose latest
 * finished result was recorded longest ago, ties by lowest id (result ids rise in the order the Worker saved them).
 */
const NEXT_WORDS = `
  WITH finished AS (
    SELECT json_extract(j.value, '$.id') AS word_id, MAX(r.id) AS last_result
    FROM results r, json_each(r.detail, '$.words') j
    WHERE r.child_id = ? AND r.kind = 'spelling' AND r.finished = 1
    GROUP BY word_id
  )
  SELECT w.id FROM words w LEFT JOIN finished f ON f.word_id = w.id
  ORDER BY f.last_result IS NOT NULL, f.last_result, w.id
  LIMIT ${SPELLING.words}`

interface WordRow {
  id: number
  word: string
  sentence: string
  alternates: string
}

interface AttemptWord {
  id: number
  word: string
  sentence: string
  alternates: string[]
}

/** The words with these ids, in the order given; a word that is gone is left out. */
async function wordsOf(db: D1Database, ids: number[]): Promise<AttemptWord[]> {
  const { results } = await db
    .prepare(
      `SELECT w.id, w.word, w.sentence, w.alternates FROM json_each(?) j JOIN words w ON w.id = j.value ORDER BY j.key`,
    )
    .bind(JSON.stringify(ids))
    .all<WordRow>()
  return results.map((w) => ({ ...w, alternates: JSON.parse(w.alternates) as string[] }))
}

/** What the iPad gets of a word: exactly these four things (SPEC §6.11). */
const forIpad = ({ id, word, sentence, alternates }: AttemptWord) => ({ id, word, sentence, alternates })

/** POST /api/spelling/start: her next words and an attempt to answer them. */
export async function postSpellingStart({ db, device, childId, now }: ChildRequest): Promise<Response> {
  const today = utcDay(now)

  // An attempt she left unchecked comes again with the same words and today as its day (§6.11), while all of its
  // words are still there (an edit or delete of one voids it).
  const left = await db
    .prepare(
      'SELECT id, words FROM spelling_attempts WHERE device_id = ? AND child_id = ? AND used = 0 ORDER BY id DESC LIMIT 1',
    )
    .bind(device, childId)
    .first<{ id: number; words: string }>()
  if (left) {
    const ids = JSON.parse(left.words) as number[]
    const words = await wordsOf(db, ids)
    if (words.length === ids.length) {
      const kept = await db
        .prepare('UPDATE spelling_attempts SET issued_day = ? WHERE id = ? AND used = 0 RETURNING id')
        .bind(today, left.id)
        .first()
      if (kept) return json(200, { attempt: left.id, words: words.map(forIpad) })
    }
  }

  const { results } = await db.prepare(NEXT_WORDS).bind(childId).all<{ id: number }>()
  if (results.length === 0) return json(200, { words: null })
  const ids = results.map((r) => r.id)
  const made = await db
    .prepare('INSERT INTO spelling_attempts (device_id, child_id, issued_day, words) VALUES (?, ?, ?, ?)')
    .bind(device, childId, today, JSON.stringify(ids))
    .run()
  const attempt = made.meta.last_row_id
  const words = await wordsOf(db, ids)
  // A word deleted or changed since the list was read voided attempts that didn't exist yet, so look once more: an
  // attempt that is gone, or a word that is, is not handed out, and she asks again.
  const there = await db.prepare('SELECT 1 AS ok FROM spelling_attempts WHERE id = ?').bind(attempt).first()
  if (!there || words.length !== ids.length) {
    await db.prepare('DELETE FROM spelling_attempts WHERE id = ? AND used = 0').bind(attempt).run()
    return error(503, 'busy')
  }
  return json(200, { attempt, words: words.map(forIpad) })
}

interface SpellingBody {
  attempt: number
  day: string
  answers: { word: number; typed: string }[]
}

function parseSpellingResult(body: unknown): SpellingBody | null {
  if (typeof body !== 'object' || body === null) return null
  const { attempt, day, answers } = body as Record<string, unknown>
  if (!isUint32(attempt) || typeof day !== 'string' || !Array.isArray(answers)) return null
  const shaped = answers.every(
    (a) =>
      typeof a === 'object' &&
      a !== null &&
      isUint32((a as any).word) &&
      typeof (a as any).typed === 'string' &&
      (a as any).typed.length <= SPELLING.typedLength,
  )
  if (!shaped) return null
  try {
    dayNumber(day)
  } catch {
    return null
  }
  return { attempt, day, answers }
}

interface StoredSpelling {
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

interface SnapshotWord extends AttemptWord {
  typed: string
  matched: boolean
}

/** What the result of a spelling assignment shows: the totals, and per word whether she was right (SPEC §8). */
function toSpellingResult(attempt: number, row: StoredSpelling) {
  const detail = JSON.parse(row.detail) as { words: SnapshotWord[] }
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
    words: detail.words.map((w) => ({ id: w.id, right: w.matched, rightSpelling: w.word })),
  }
}

const findSpelling = (db: D1Database, attempt: number) =>
  db.prepare('SELECT * FROM results WHERE spelling_attempt = ?').bind(attempt).first<StoredSpelling>()

/** POST /api/spelling/result { attempt, day, answers } (SPEC §6.8). */
export async function postSpellingResult({
  request,
  db,
  device,
  childId,
  now,
}: ChildRequest): Promise<Response> {
  const body = parseSpellingResult(await readJson(request))
  if (!body) return error(400, 'bad_result')

  const attempt = await db
    .prepare('SELECT device_id, child_id, issued_day, words FROM spelling_attempts WHERE id = ?')
    .bind(body.attempt)
    .first<{ device_id: number; child_id: number; issued_day: string; words: string }>()
  if (!attempt || attempt.device_id !== device || attempt.child_id !== childId)
    return error(404, 'unknown_attempt')

  const recorded = await findSpelling(db, body.attempt)
  if (recorded) {
    return json(200, {
      result: toSpellingResult(body.attempt, recorded),
      state: await readState(db, device, childId),
    })
  }

  const ids = JSON.parse(attempt.words) as number[]
  const words = await wordsOf(db, ids)
  // A word that is gone voided the attempt (SPEC §6.11).
  if (words.length !== ids.length) return error(404, 'unknown_attempt')
  // Every word exactly once, and no word that isn't in the attempt (nothing is recorded otherwise).
  const typedBy = new Map<number, string>()
  for (const { word, typed } of body.answers) typedBy.set(word, typed)
  const valid =
    body.answers.length === words.length &&
    typedBy.size === words.length &&
    words.every((w) => typedBy.has(w.id))
  if (!valid) return error(400, 'bad_answers')

  const typed = words.map((w) => typedBy.get(w.id)!)
  const correct = scoreSpelling(words, typed)
  const size = words.length
  const day = clampDay(body.day, attempt.issued_day, now)
  const clockWrong = day !== body.day
  // The words as they are now, kept with the result so a later edit or delete can't change it (SPEC §6.8, D15).
  const detail = JSON.stringify({
    words: words.map((w, i) => ({
      ...w,
      typed: typed[i],
      matched: checkSpelling(typed[i]!, w.word, w.alternates),
    })),
  })

  for (let tries = 0; tries < WRITE_ATTEMPTS; tries++) {
    const child = await db
      .prepare('SELECT balance, streak, last_day, completed, revision FROM children WHERE id = ?')
      .bind(childId)
      .first<ChildRow>()
    if (!child) return error(500, 'no_child')
    const { earned, streak, lastDay, gradeLabel } = settleFinished({
      child,
      day,
      clockWrong,
      correct,
      size,
      pay: spellingPayout,
    })

    // The same one-transaction write as a reading result: the child update applies only if nobody wrote since we
    // read and the attempt is still there unused (an edit may have voided it), and the other two statements
    // apply only if it did.
    const revision = crypto.randomUUID()
    const [update] = await db.batch([
      db
        .prepare(
          `UPDATE children SET balance = balance + ?, completed = completed + 1, streak = ?, last_day = ?,
           revision = ? WHERE id = ? AND revision = ? AND NOT EXISTS (SELECT 1 FROM results WHERE spelling_attempt = ?)
           AND EXISTS (SELECT 1 FROM spelling_attempts WHERE id = ? AND used = 0)
           AND EXISTS (SELECT 1 FROM devices WHERE id = ? AND revoked_at IS NULL)`,
        )
        .bind(
          earned.total,
          streak,
          lastDay,
          revision,
          childId,
          child.revision,
          body.attempt,
          body.attempt,
          device,
        ),
      db
        .prepare(
          `INSERT INTO results (kind, spelling_attempt, detail, device_id, child_id, day, answers, answered, correct,
           finished, grade, base, accuracy_bonus, streak_bonus, total, created_at)
           SELECT 'spelling', ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ? WHERE (SELECT revision FROM children WHERE id = ?) = ?
           AND NOT EXISTS (SELECT 1 FROM results WHERE spelling_attempt = ?)`,
        )
        .bind(
          body.attempt,
          detail,
          device,
          childId,
          day,
          JSON.stringify(typed),
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
        ),
      db
        .prepare(
          'UPDATE spelling_attempts SET used = 1 WHERE id = ? AND (SELECT revision FROM children WHERE id = ?) = ?',
        )
        .bind(body.attempt, childId, revision),
    ])
    if (update.meta.changes === 1) {
      const saved = await findSpelling(db, body.attempt)
      return json(201, {
        result: toSpellingResult(body.attempt, saved!),
        state: await readState(db, device, childId),
      })
    }
    // Someone else wrote first; if it was this same result, return it instead of recording it twice.
    const raced = await findSpelling(db, body.attempt)
    if (raced)
      return json(200, {
        result: toSpellingResult(body.attempt, raced),
        state: await readState(db, device, childId),
      })
    // Or the iPad was unpaired while this upload was on its way: refused like any later request (§6.9).
    const active = await db
      .prepare('SELECT 1 AS ok FROM devices WHERE id = ? AND revoked_at IS NULL')
      .bind(device)
      .first()
    if (!active) return error(401, 'unauthorized')
    // Or a word was edited or deleted meanwhile, which voided the attempt.
    const there = await db
      .prepare('SELECT 1 AS ok FROM spelling_attempts WHERE id = ?')
      .bind(body.attempt)
      .first()
    if (!there) return error(404, 'unknown_attempt')
  }
  return error(503, 'busy')
}
