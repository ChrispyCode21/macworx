// Adding and renaming a child (SPEC §5.3, §8). Children can't be deleted, so there is no route for it.
import { checkChildFields, cleanGrade, cleanInitials, cleanName } from '../src/parent/childFields'
import type { ChildFields } from '../src/parent/childFields'
import { error, json, readJson } from './http'
import type { ParentRequest } from './parent'

const WRITE_ATTEMPTS = 3

/** The request's JSON body as an object, or undefined when it isn't one. */
async function readObject(request: Request): Promise<Record<string, unknown> | undefined> {
  const body = await readJson(request)
  return typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : undefined
}

/** POST /api/parent/children { name, grade?, initials? }: adds a child with a balance of 0. */
export async function postChild(req: ParentRequest): Promise<Response> {
  const { db, request, now } = req
  const body = await readObject(request)
  if (!body) return error(400, 'bad_body')
  const checked = checkChildFields(body)
  if (!checked.ok) return error(400, checked.error)
  const { fields } = checked

  // One transaction, so a child is never added without its log row. The log row takes the new child's id.
  const [insert] = await db.batch([
    db
      .prepare('INSERT INTO children (name, grade, initials, created_at, revision) VALUES (?, ?, ?, ?, ?)')
      .bind(fields.name, fields.grade, fields.initials, now.toISOString(), crypto.randomUUID()),
    db
      .prepare(
        `INSERT INTO admin_log (at, email, action, detail, child_id)
         SELECT ?, ?, 'child_add', ?, last_insert_rowid()`,
      )
      .bind(now.toISOString(), req.email, JSON.stringify(fields)),
  ])
  return json(201, { id: insert.meta.last_row_id, ...fields })
}

/** PATCH /api/parent/children/:id { name?, grade?, initials? }: changes the fields sent. */
export async function patchChild(req: ParentRequest): Promise<Response> {
  const { db, request, now, email, params } = req
  const id = Number(params.id)
  const body = await readObject(request)
  if (!body) return error(400, 'bad_body')
  if (!('name' in body || 'grade' in body || 'initials' in body)) return error(400, 'bad_body')

  for (let attempt = 0; attempt < WRITE_ATTEMPTS; attempt++) {
    const stored = await db
      .prepare('SELECT id, name, grade, initials, revision FROM children WHERE id = ?')
      .bind(id)
      .first<{ id: number; name: string; grade: string; initials: string; revision: string }>()
    if (!stored) return error(404, 'unknown_child')
    const before: ChildFields = { name: stored.name, grade: stored.grade, initials: stored.initials }

    const name = 'name' in body ? cleanName(body.name) : before.name
    if (name === null) return error(400, 'bad_name')
    const grade = 'grade' in body ? cleanGrade(body.grade) : before.grade
    if (grade === null) return error(400, 'bad_grade')
    const initials = 'initials' in body ? cleanInitials(body.initials, name) : before.initials
    if (initials === null) return error(400, 'bad_initials')
    const after: ChildFields = { name, grade, initials }

    // Nothing changed: nothing is written and nothing is logged.
    if (after.name === before.name && after.grade === before.grade && after.initials === before.initials)
      return json(200, { id, ...after })

    // One transaction: the update applies only if nobody wrote since we read, and the log row only if it did.
    const revision = crypto.randomUUID()
    const [update] = await db.batch([
      db
        .prepare('UPDATE children SET name = ?, grade = ?, initials = ?, revision = ? WHERE id = ? AND revision = ?')
        .bind(name, grade, initials, revision, id, stored.revision),
      db
        .prepare(
          `INSERT INTO admin_log (at, email, action, detail, child_id)
           SELECT ?, ?, 'child_rename', ?, ? WHERE (SELECT revision FROM children WHERE id = ?) = ?`,
        )
        .bind(now.toISOString(), email, JSON.stringify({ before, after }), id, id, revision),
    ])
    if (update.meta.changes === 1) return json(200, { id, ...after })
  }
  return error(503, 'busy')
}
