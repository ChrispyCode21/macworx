// The child API (SPEC §6.8, §8): her state, seeds, and recording results. The engine decides every number.
import {
  addDays,
  ASSIGNMENT_SIZE,
  checkAnswer,
  dayNumber,
  generateAssignment,
  grade,
  leftEarlyPayout,
  nextStreak,
  payout,
  type Payout,
} from '../src/engine'
import { error, isUint32, json, readJson, utcDay } from './http'

export interface ChildRequest {
  request: Request
  url: URL
  db: D1Database
  device: number
  now: Date
}

const MAX_UNUSED_SEEDS = 20
const MAX_PENDING = 100
const MAX_ANSWER = 999_999
const WRITE_ATTEMPTS = 3

interface ChildRow {
  balance: number
  streak: number
  last_day: string | null
  completed: number
  revision: string
}

interface ResultRow {
  seed: number
  device_id: number
  day: string
  answered: number
  correct: number
  finished: number
  grade: string | null
  base: number
  accuracy_bonus: number
  streak_bonus: number
  total: number
}

function toResult(row: ResultRow) {
  return {
    seed: row.seed,
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
    } satisfies Payout,
  }
}

async function readState(db: D1Database, device: number, pending: number[] = []) {
  const child = await db
    .prepare('SELECT balance, streak, last_day, completed FROM child WHERE id = 1')
    .first<ChildRow>()
  const latest = await db
    .prepare('SELECT grade FROM results WHERE finished = 1 ORDER BY id DESC LIMIT 1')
    .first<{ grade: string }>()
  const applied = pending.length
    ? (
        await db
          .prepare(
            // One JSON parameter, not one per seed: D1 allows at most 100 bound parameters.
            'SELECT seed FROM results WHERE device_id = ? AND seed IN (SELECT value FROM json_each(?))',
          )
          .bind(device, JSON.stringify(pending))
          .all<{ seed: number }>()
      ).results.map((r) => r.seed)
    : []
  return {
    balance: child?.balance ?? 0,
    streak: child?.streak ?? 0,
    lastDay: child?.last_day ?? null,
    completed: child?.completed ?? 0,
    latestGrade: latest?.grade ?? null,
    applied,
  }
}

/** GET /api/state?pending=1,2,3 */
export async function getState({ url, db, device }: ChildRequest): Promise<Response> {
  const raw = url.searchParams.get('pending')
  const pending = raw ? raw.split(',').map(Number) : []
  if (pending.length > MAX_PENDING || !pending.every(isUint32)) return error(400, 'bad_pending')
  return json(200, await readState(db, device, pending))
}

/** POST /api/seeds: tops the device up to 20 unused seeds and returns them. */
export async function postSeeds({ db, device, now }: ChildRequest): Promise<Response> {
  const unused = () =>
    db
      .prepare('SELECT seed FROM seeds WHERE device_id = ? AND used = 0 ORDER BY seed')
      .bind(device)
      .all<{ seed: number }>()
      .then((r) => r.results.map((row) => row.seed))

  // A few rounds at most: a fresh random seed only collides with an existing one by rare chance.
  for (let round = 0; round < 5; round++) {
    const have = await unused()
    if (have.length >= MAX_UNUSED_SEEDS) return json(200, { seeds: have })
    const fresh = crypto.getRandomValues(new Uint32Array(MAX_UNUSED_SEEDS - have.length))
    // Each insert re-counts, so two requests at once can't push the device past 20.
    await db.batch(
      [...fresh].map((seed) =>
        db
          .prepare(
            `INSERT OR IGNORE INTO seeds (seed, device_id, issued_day)
             SELECT ?, ?, ? WHERE (SELECT COUNT(*) FROM seeds WHERE device_id = ? AND used = 0) < ?`,
          )
          .bind(seed, device, utcDay(now), device, MAX_UNUSED_SEEDS),
      ),
    )
  }
  return json(200, { seeds: await unused() })
}

interface ResultBody {
  seed: number
  day: string
  answers: number[]
}

function parseResult(body: unknown): ResultBody | null {
  if (typeof body !== 'object' || body === null) return null
  const { seed, day, answers } = body as Record<string, unknown>
  if (!isUint32(seed) || typeof day !== 'string' || !Array.isArray(answers)) return null
  if (answers.length < 1 || answers.length > ASSIGNMENT_SIZE) return null
  const wholeNumbers = answers.every(
    (a) => typeof a === 'number' && Number.isInteger(a) && a >= 0 && a <= MAX_ANSWER,
  )
  if (!wholeNumbers) return null
  try {
    dayNumber(day)
  } catch {
    return null
  }
  return { seed, day, answers }
}

/** The day moved into range: no earlier than the day before the seed was handed out, no later than tomorrow. */
function clampDay(day: string, issuedDay: string, now: Date): string {
  const earliest = addDays(issuedDay, -1)
  const latest = addDays(utcDay(now), 1)
  if (dayNumber(day) < dayNumber(earliest)) return earliest
  if (dayNumber(day) > dayNumber(latest)) return latest
  return day
}

const findResult = (db: D1Database, seed: number) =>
  db.prepare('SELECT * FROM results WHERE seed = ?').bind(seed).first<ResultRow>()

/** POST /api/results { seed, day, answers } (SPEC §6.8). */
export async function postResult({ request, db, device, now }: ChildRequest): Promise<Response> {
  const body = parseResult(await readJson(request))
  if (!body) return error(400, 'bad_result')

  const recorded = await findResult(db, body.seed)
  if (recorded) {
    if (recorded.device_id !== device) return error(404, 'unknown_seed')
    return json(200, { result: toResult(recorded), state: await readState(db, device) })
  }
  const seedRow = await db
    .prepare('SELECT device_id, issued_day FROM seeds WHERE seed = ?')
    .bind(body.seed)
    .first<{ device_id: number; issued_day: string }>()
  if (!seedRow || seedRow.device_id !== device) return error(404, 'unknown_seed')

  const day = clampDay(body.day, seedRow.issued_day, now)
  // A day that had to be moved came from a wrong clock, so it doesn't touch the streak (§6.8, W7).
  const clockWrong = day !== body.day
  const problems = generateAssignment(body.seed)
  const answered = body.answers.length
  const correct = body.answers.filter((a, i) => checkAnswer(problems[i], a)).length
  const finished = answered === ASSIGNMENT_SIZE

  for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt++) {
    const child = await db
      .prepare('SELECT balance, streak, last_day, completed, revision FROM child WHERE id = 1')
      .first<ChildRow>()
    if (!child) return error(500, 'no_child')

    let earned: Payout
    let streak = child.streak
    let lastDay = child.last_day
    let gradeLabel: string | null = null
    if (finished && clockWrong) {
      earned = payout({ correct, problemCount: answered, firstOfDay: false, streak })
      gradeLabel = grade(correct, answered)
    } else if (finished) {
      // A result that arrives with a day before her last counted day counts as that day (§6.8).
      const streakDay = lastDay && dayNumber(day) < dayNumber(lastDay) ? lastDay : day
      const next = nextStreak({ streak, lastDay }, streakDay)
      earned = payout({ correct, problemCount: answered, firstOfDay: next.firstOfDay, streak: next.streak })
      ;({ streak, lastDay } = next)
      gradeLabel = grade(correct, answered)
    } else {
      earned = leftEarlyPayout({ correct, answered, problemCount: ASSIGNMENT_SIZE })
    }

    // One transaction: the child update applies only if nobody wrote since we read, and the other two
    // statements apply only if it did (they check for this write's new revision).
    const revision = crypto.randomUUID()
    const [update] = await db.batch([
      db
        .prepare(
          `UPDATE child SET balance = balance + ?, completed = completed + ?, streak = ?, last_day = ?,
           revision = ? WHERE id = 1 AND revision = ? AND NOT EXISTS (SELECT 1 FROM results WHERE seed = ?)
           AND EXISTS (SELECT 1 FROM devices WHERE id = ? AND revoked_at IS NULL)`,
        )
        .bind(earned.total, finished ? 1 : 0, streak, lastDay, revision, child.revision, body.seed, device),
      db
        .prepare(
          `INSERT INTO results (seed, device_id, day, answers, answered, correct, finished, grade, base,
           accuracy_bonus, streak_bonus, total, created_at)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE (SELECT revision FROM child WHERE id = 1) = ?
           AND NOT EXISTS (SELECT 1 FROM results WHERE seed = ?)`,
        )
        .bind(
          body.seed,
          device,
          day,
          JSON.stringify(body.answers),
          answered,
          correct,
          finished ? 1 : 0,
          gradeLabel,
          earned.base,
          earned.accuracyBonus,
          earned.streakBonus,
          earned.total,
          now.toISOString(),
          revision,
          body.seed,
        ),
      db
        .prepare('UPDATE seeds SET used = 1 WHERE seed = ? AND (SELECT revision FROM child WHERE id = 1) = ?')
        .bind(body.seed, revision),
    ])
    if (update.meta.changes === 1) {
      const saved = await findResult(db, body.seed)
      return json(201, { result: toResult(saved!), state: await readState(db, device) })
    }
    // Someone else wrote first; if it was this same result, return it instead of recording it twice.
    const raced = await findResult(db, body.seed)
    if (raced) return json(200, { result: toResult(raced), state: await readState(db, device) })
    // Or the iPad was unpaired while this upload was on its way: refused like any later request (§6.9).
    const active = await db
      .prepare('SELECT 1 AS ok FROM devices WHERE id = ? AND revoked_at IS NULL')
      .bind(device)
      .first()
    if (!active) return error(401, 'unauthorized')
  }
  return error(503, 'busy')
}
