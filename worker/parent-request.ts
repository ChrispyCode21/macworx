// What every parent route receives, and the helper most of them start with (SPEC §5.3, §8).
// Kept out of parent.ts so the route modules (pair.ts, children.ts) don't import the module that imports them.
import { error } from './http'

export interface ParentRequest {
  request: Request
  url: URL
  db: D1Database
  email: string
  now: Date
  /** Path parameters, e.g. { id } for /api/parent/devices/:id. */
  params: Record<string, string>
}

/**
 * The chosen child's id from the `child` query parameter (SPEC §8), or the error response to answer with:
 * 400 bad_child for a missing or non-numeric id, 404 unknown_child for one that doesn't exist.
 */
export async function childOf({ url, db }: ParentRequest): Promise<number | Response> {
  const raw = url.searchParams.get('child') ?? ''
  const id = /^\d{1,9}$/.test(raw) ? Number(raw) : 0
  if (id < 1) return error(400, 'bad_child')
  const row = await db.prepare('SELECT id FROM children WHERE id = ?').bind(id).first()
  return row ? id : error(404, 'unknown_child')
}
