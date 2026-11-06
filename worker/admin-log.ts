// The admin log (SPEC §5.3): one row for each change a parent makes, written in the same batch as the change.
import type { ParentRequest } from './parent-request'

/** A statement recording one admin change (SPEC §5.3), to run in the same batch as the change. */
export function logChange(
  db: D1Database,
  { email, now }: ParentRequest,
  childId: number,
  action: string,
  detail: object,
) {
  return db
    .prepare('INSERT INTO admin_log (at, email, action, detail, child_id) VALUES (?, ?, ?, ?, ?)')
    .bind(now.toISOString(), email, action, JSON.stringify(detail), childId)
}
