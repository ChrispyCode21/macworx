// The parent API (SPEC §5.3, §6.9, §8). Every route here runs only after parentEmail() accepted the request.
import {
  addDays,
  ASSIGNMENT_SIZE,
  checkAnswer,
  dayNumber,
  generateAssignment,
  grade,
  leftEarlyPayout,
  MAX_ANSWER,
  PAYOUT,
  payout,
} from '../src/engine'
import { error, json, readJson, utcDay } from './http'
import { postPairingCode } from './pair'

export interface ParentRequest {
  request: Request
  url: URL
  db: D1Database
  email: string
  now: Date
  /** Path parameters, e.g. { id } for /api/parent/devices/:id. */
  params: Record<string, string>
}

/** GET /api/parent/devices */
export async function listDevices({ db }: ParentRequest): Promise<Response> {
  const { results } = await db
    .prepare('SELECT id, label, created_at, revoked_at FROM devices ORDER BY id')
    .all<{ id: number; label: string; created_at: string; revoked_at: string | null }>()
  return json(200, {
    devices: results.map((d) => ({
      id: d.id,
      label: d.label,
      createdAt: d.created_at,
      revokedAt: d.revoked_at,
    })),
  })
}

/** How many results and log entries the dashboard lists (SPEC §5.3). */
const LIST_LIMIT = 50

/** GET /api/parent/summary: her totals. */
export async function getSummary({ db }: ParentRequest): Promise<Response> {
  const row = await db
    .prepare('SELECT balance, streak, last_day, completed FROM child WHERE id = 1')
    .first<{ balance: number; streak: number; last_day: string | null; completed: number }>()
  if (!row) return error(500, 'server')
  return json(200, {
    balance: row.balance,
    streak: row.streak,
    lastDay: row.last_day,
    completed: row.completed,
  })
}

/** GET /api/parent/results: the latest recorded results, newest first. */
export async function listResults({ db }: ParentRequest): Promise<Response> {
  const { results } = await db
    .prepare(
      `SELECT id, day, answered, correct, finished, grade, total FROM results
       ORDER BY day DESC, id DESC LIMIT ?`,
    )
    .bind(LIST_LIMIT)
    .all<{
      id: number
      day: string
      answered: number
      correct: number
      finished: number
      grade: string | null
      total: number
    }>()
  return json(200, {
    results: results.map((r) => ({
      id: r.id,
      day: r.day,
      answered: r.answered,
      correct: r.correct,
      finished: r.finished === 1,
      grade: r.grade,
      total: r.total,
    })),
  })
}

/** GET /api/parent/log: the latest admin log entries, newest first. */
export async function listLog({ db }: ParentRequest): Promise<Response> {
  const { results } = await db
    .prepare('SELECT id, at, email, action, detail FROM admin_log ORDER BY id DESC LIMIT ?')
    .bind(LIST_LIMIT)
    .all<{ id: number; at: string; email: string; action: string; detail: string }>()
  return json(200, {
    entries: results.map((e) => ({
      id: e.id,
      at: e.at,
      email: e.email,
      action: e.action,
      detail: parseDetail(e.detail),
    })),
  })
}

/** An entry's details as an object; anything that isn't one reads as empty. */
function parseDetail(text: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(text)
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}

/** A statement recording one admin change (SPEC §5.3), to run in the same batch as the change. */
export function logChange(db: D1Database, { email, now }: ParentRequest, action: string, detail: object) {
  return db
    .prepare('INSERT INTO admin_log (at, email, action, detail) VALUES (?, ?, ?, ?)')
    .bind(now.toISOString(), email, action, JSON.stringify(detail))
}

/** DELETE /api/parent/devices/:id: unpairs an iPad. Its key is refused from then on (§6.9). */
export async function unpairDevice(req: ParentRequest): Promise<Response> {
  const { db, now, params } = req
  const id = Number(params.id)
  if (!Number.isInteger(id) || id < 1) return error(404, 'unknown_device')
  const device = await db
    .prepare('SELECT revoked_at FROM devices WHERE id = ?')
    .bind(id)
    .first<{ revoked_at: string | null }>()
  if (!device) return error(404, 'unknown_device')
  // Unpairing twice is fine: the first time is the one recorded, and the only one logged.
  if (device.revoked_at === null) {
    await db.batch([
      db
        .prepare('UPDATE devices SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL')
        .bind(now.toISOString(), id),
      logChange(db, req, 'unpair', { deviceId: id }),
    ])
  }
  return json(200, { ok: true })
}

const MAX_STREAK = 3650
const WRITE_ATTEMPTS = 3

/** The checked body of POST /api/parent/streak, or the error code to answer with. */
function parseStreak(body: unknown, now: Date): { streak: number; lastDay: string | null } | string {
  if (typeof body !== 'object' || body === null) return 'bad_streak'
  const { streak, lastDay } = body as Record<string, unknown>
  if (typeof streak !== 'number' || !Number.isInteger(streak) || streak < 0 || streak > MAX_STREAK)
    return 'bad_streak'
  if (lastDay === undefined) return 'bad_day'
  // Empty means no last counted day, and only a streak of 0 can go with that.
  if (lastDay === null || lastDay === '') return streak === 0 ? { streak, lastDay: null } : 'bad_day'
  if (typeof lastDay !== 'string') return 'bad_day'
  try {
    // addDays is the calendar check: it throws for a bad format and for a day like 2026-02-30.
    if (addDays(lastDay, 0) !== lastDay) return 'bad_day'
    if (dayNumber(lastDay) > dayNumber(utcDay(now)) + 1) return 'bad_day'
  } catch {
    return 'bad_day'
  }
  return { streak, lastDay }
}

/** POST /api/parent/streak { streak, lastDay }: sets her streak and last counted day (SPEC §5.3). */
export async function postStreak(req: ParentRequest): Promise<Response> {
  const { request, db, email, now } = req
  const parsed = parseStreak(await readJson(request), now)
  if (typeof parsed === 'string') return error(400, parsed)

  for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt++) {
    const child = await db
      .prepare('SELECT streak, last_day, revision FROM child WHERE id = 1')
      .first<{ streak: number; last_day: string | null; revision: string }>()
    if (!child) return error(500, 'no_child')
    const revision = crypto.randomUUID()
    const detail = {
      before: { streak: child.streak, lastDay: child.last_day },
      after: parsed,
    }
    // One transaction: the update applies only if nobody wrote since we read, and the log row only if it did.
    const [update] = await db.batch([
      db
        .prepare('UPDATE child SET streak = ?, last_day = ?, revision = ? WHERE id = 1 AND revision = ?')
        .bind(parsed.streak, parsed.lastDay, revision, child.revision),
      db
        .prepare(
          `INSERT INTO admin_log (at, email, action, detail)
           SELECT ?, ?, 'streak', ? WHERE (SELECT revision FROM child WHERE id = 1) = ?`,
        )
        .bind(now.toISOString(), email, JSON.stringify(detail), revision),
    ])
    if (update.meta.changes === 1) return getSummary(req)
  }
  return error(503, 'busy')
}

/** The limits on an adjustment (SPEC §5.3). */
const MAX_AMOUNT = 100_000
const MAX_NOTE = 200

/** POST /api/parent/balance { amount, note }: adds or removes Macaronis, never below 0 (SPEC §5.3). */
export async function postBalance(req: ParentRequest): Promise<Response> {
  const { db, request } = req
  const body = (await readJson(request)) as { amount?: unknown; note?: unknown } | null | undefined
  const amount = body?.amount
  if (
    typeof amount !== 'number' ||
    !Number.isInteger(amount) ||
    amount === 0 ||
    Math.abs(amount) > MAX_AMOUNT
  )
    return error(400, 'bad_amount')
  const note = typeof body?.note === 'string' ? body.note.trim() : ''
  if (note.length < 1 || note.length > MAX_NOTE) return error(400, 'bad_note')

  for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt++) {
    const child = await db
      .prepare('SELECT balance, revision FROM child WHERE id = 1')
      .first<{ balance: number; revision: string }>()
    if (!child) return error(500, 'server')
    const after = child.balance + amount
    if (after < 0) return json(409, { error: 'overdraw', balance: child.balance })

    // One transaction: the balance changes only if nobody wrote since we read, and the log row is
    // written only if it did (it checks for this write's new revision).
    const revision = crypto.randomUUID()
    const [update] = await db.batch([
      db
        .prepare('UPDATE child SET balance = balance + ?, revision = ? WHERE id = 1 AND revision = ?')
        .bind(amount, revision, child.revision),
      db
        .prepare(
          `INSERT INTO admin_log (at, email, action, detail)
           SELECT ?, ?, 'balance', ? WHERE (SELECT revision FROM child WHERE id = 1) = ?`,
        )
        .bind(
          req.now.toISOString(),
          req.email,
          JSON.stringify({ amount, before: child.balance, after, note }),
          revision,
        ),
    ])
    if (update.meta.changes === 1) return json(200, { balance: after })
  }
  return error(503, 'busy')
}

interface StoredResult {
  id: number
  seed: number
  day: string
  answers: string
  answered: number
  correct: number
  finished: number
  grade: string | null
  streak_bonus: number
  total: number
}

const RESULT_COLUMNS = 'id, seed, day, answers, answered, correct, finished, grade, streak_bonus, total'

/** A stored result's answers, or null when they don't match its answered count. */
function storedAnswers(row: StoredResult): number[] | null {
  try {
    const value: unknown = JSON.parse(row.answers)
    return Array.isArray(value) && value.length === row.answered && value.every((a) => typeof a === 'number')
      ? (value as number[])
      : null
  } catch {
    return null
  }
}

/** One result with its problems, her answers and the right answers (SPEC §8). */
function resultView(row: StoredResult, answers: number[]) {
  const problems = generateAssignment(row.seed)
  return {
    id: row.id,
    day: row.day,
    answered: row.answered,
    correct: row.correct,
    finished: row.finished === 1,
    grade: row.grade,
    total: row.total,
    problems: answers.map((answer, i) => ({
      operation: problems[i].operation,
      a: problems[i].a,
      b: problems[i].b,
      answer,
      rightAnswer: problems[i].answer,
    })),
  }
}

/** GET /api/parent/results/:id: one recorded result with its problems. */
export async function getResult({ db, params }: ParentRequest): Promise<Response> {
  const id = Number(params.id)
  if (!Number.isInteger(id) || id < 1) return error(404, 'unknown_result')
  const row = await db
    .prepare(`SELECT ${RESULT_COLUMNS} FROM results WHERE id = ?`)
    .bind(id)
    .first<StoredResult>()
  if (!row) return error(404, 'unknown_result')
  const answers = storedAnswers(row)
  if (!answers) return error(500, 'server')
  return json(200, { result: resultView(row, answers) })
}

/** What a result pays and how it grades once its answers are `answers` (SPEC §5.3, §6.4). */
function rescore(row: StoredResult, answers: number[]) {
  const problems = generateAssignment(row.seed)
  const correct = answers.filter((a, i) => checkAnswer(problems[i], a)).length
  if (row.finished !== 1) {
    const p = leftEarlyPayout({ correct, answered: row.answered, problemCount: ASSIGNMENT_SIZE })
    return { correct, grade: null, base: p.base, accuracyBonus: 0, total: p.total }
  }
  // The streak bonus stays as originally paid, so only base and accuracy come from the engine.
  const p = payout({ correct, problemCount: row.answered, firstOfDay: false, streak: 0 })
  return {
    correct,
    grade: grade(correct, row.answered) as string,
    base: p.base,
    accuracyBonus: p.accuracyBonus,
    total: Math.max(PAYOUT.minimum, p.base + p.accuracyBonus + row.streak_bonus),
  }
}

/** POST /api/parent/results/:id/correct { answers, note }: corrects a recorded result (SPEC §5.3). */
export async function postCorrection(req: ParentRequest): Promise<Response> {
  const { db, request, params } = req
  const id = Number(params.id)
  if (!Number.isInteger(id) || id < 1) return error(404, 'unknown_result')
  const body = (await readJson(request)) as { answers?: unknown; note?: unknown } | null | undefined
  const answers = body?.answers
  if (
    !Array.isArray(answers) ||
    answers.length < 1 ||
    answers.length > ASSIGNMENT_SIZE ||
    !answers.every((a) => typeof a === 'number' && Number.isInteger(a) && a >= 0 && a <= MAX_ANSWER)
  )
    return error(400, 'bad_answers')
  const note = typeof body?.note === 'string' ? body.note.trim() : ''
  if (note.length < 1 || note.length > MAX_NOTE) return error(400, 'bad_note')
  const newAnswers = answers as number[]

  for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt++) {
    // Everything is read again on every attempt: another write may have changed the balance or result.
    const row = await db
      .prepare(`SELECT ${RESULT_COLUMNS} FROM results WHERE id = ?`)
      .bind(id)
      .first<StoredResult>()
    if (!row) return error(404, 'unknown_result')
    const old = storedAnswers(row)
    if (!old) return error(500, 'server')
    if (newAnswers.length !== row.answered) return error(400, 'bad_answers')
    if (newAnswers.every((a, i) => a === old[i])) return error(400, 'no_change')
    const child = await db
      .prepare('SELECT balance, revision FROM child WHERE id = 1')
      .first<{ balance: number; revision: string }>()
    if (!child) return error(500, 'server')

    const next = rescore(row, newAnswers)
    const diff = next.total - row.total
    const balanceAfter = child.balance + diff
    if (balanceAfter < 0) return json(409, { error: 'overdraw', balance: child.balance })

    // One transaction: the balance changes only if nobody wrote since we read; the result and the log
    // row are written only if it did (they check for this write's new revision).
    const revision = crypto.randomUUID()
    const detail = {
      resultId: id,
      day: row.day,
      before: { correct: row.correct, grade: row.grade, total: row.total },
      after: { correct: next.correct, grade: next.grade, total: next.total },
      balanceBefore: child.balance,
      balanceAfter,
      note,
    }
    const [update] = await db.batch([
      db
        .prepare('UPDATE child SET balance = balance + ?, revision = ? WHERE id = 1 AND revision = ?')
        .bind(diff, revision, child.revision),
      db
        .prepare(
          `UPDATE results SET answers = ?, correct = ?, grade = ?, base = ?, accuracy_bonus = ?, total = ?
           WHERE id = ? AND (SELECT revision FROM child WHERE id = 1) = ?`,
        )
        .bind(
          JSON.stringify(newAnswers),
          next.correct,
          next.grade,
          next.base,
          next.accuracyBonus,
          next.total,
          id,
          revision,
        ),
      db
        .prepare(
          `INSERT INTO admin_log (at, email, action, detail)
           SELECT ?, ?, 'correction', ? WHERE (SELECT revision FROM child WHERE id = 1) = ?`,
        )
        .bind(req.now.toISOString(), req.email, JSON.stringify(detail), revision),
    ])
    if (update.meta.changes === 1) {
      const view = resultView(
        { ...row, correct: next.correct, grade: next.grade, total: next.total },
        newAnswers,
      )
      return json(200, { result: view, balance: balanceAfter })
    }
  }
  return error(503, 'busy')
}

/** Parent routes, matched on method and path pattern. */
export const PARENT_ROUTES: {
  method: string
  pattern: RegExp
  run: (req: ParentRequest) => Promise<Response>
}[] = [
  { method: 'GET', pattern: /^\/api\/parent\/summary$/, run: getSummary },
  { method: 'GET', pattern: /^\/api\/parent\/results$/, run: listResults },
  { method: 'GET', pattern: /^\/api\/parent\/results\/(?<id>\d+)$/, run: getResult },
  { method: 'POST', pattern: /^\/api\/parent\/results\/(?<id>\d+)\/correct$/, run: postCorrection },
  { method: 'GET', pattern: /^\/api\/parent\/log$/, run: listLog },
  { method: 'GET', pattern: /^\/api\/parent\/devices$/, run: listDevices },
  { method: 'DELETE', pattern: /^\/api\/parent\/devices\/(?<id>\d+)$/, run: unpairDevice },
  { method: 'POST', pattern: /^\/api\/parent\/balance$/, run: postBalance },
  { method: 'POST', pattern: /^\/api\/parent\/pairing-code$/, run: (req) => postPairingCode(req) },
  { method: 'POST', pattern: /^\/api\/parent\/streak$/, run: postStreak },
]
