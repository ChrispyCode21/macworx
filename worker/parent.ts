// The parent API (SPEC §5.3, §6.9, §8). Every route here runs only after parentEmail() accepted the request.
import { error, json } from './http'
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

/** Parent routes, matched on method and path pattern. */
export const PARENT_ROUTES: {
  method: string
  pattern: RegExp
  run: (req: ParentRequest) => Promise<Response>
}[] = [
  { method: 'GET', pattern: /^\/api\/parent\/summary$/, run: getSummary },
  { method: 'GET', pattern: /^\/api\/parent\/results$/, run: listResults },
  { method: 'GET', pattern: /^\/api\/parent\/log$/, run: listLog },
  { method: 'GET', pattern: /^\/api\/parent\/devices$/, run: listDevices },
  { method: 'DELETE', pattern: /^\/api\/parent\/devices\/(?<id>\d+)$/, run: unpairDevice },
  { method: 'POST', pattern: /^\/api\/parent\/pairing-code$/, run: (req) => postPairingCode(req) },
]
