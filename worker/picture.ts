// Uploading a passage's picture from the parent portal (SPEC §6.10, §8). The Access token is already checked.
import { MAX_PICTURE, pictureType } from '../src/engine'
import { error, json } from './http'
import type { ParentRequest } from './parent-request'

const bad = () => error(400, 'bad_image')

/** The request body, or null once it is longer than `MAX_PICTURE`: it is read only as far as that. */
async function readCapped(request: Request): Promise<Uint8Array | null> {
  const declared = Number(request.headers.get('Content-Length'))
  if (Number.isFinite(declared) && declared > MAX_PICTURE) return null
  if (!request.body) return new Uint8Array()
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    length += value.length
    if (length > MAX_PICTURE) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  const out = new Uint8Array(length)
  let at = 0
  for (const chunk of chunks) {
    out.set(chunk, at)
    at += chunk.length
  }
  return out
}

/**
 * PUT /api/parent/passages/:id/image: the picture's bytes as the body. The type comes from the bytes, and the file is
 * stored as `<id>.<extension>`. The new file goes to R2 first and the passage row follows, so a failure between the
 * two leaves a file nobody can reach and never a row pointing at nothing; the old file goes last. The row changes
 * only if it still holds the name this upload read, so two uploads at once can't each remove the other's file: the
 * one that loses is told to try again (409 `busy`) and takes back its own file unless the row now holds that name.
 */
export async function putPicture({ request, db, params, bucket }: ParentRequest): Promise<Response> {
  const id = Number(params.id)
  const row = await db
    .prepare('SELECT image FROM passages WHERE id = ?')
    .bind(id)
    .first<{ image: string | null }>()
  if (!row) return error(404, 'unknown_passage')
  if (!bucket) return error(503, 'no_picture_store')

  const bytes = await readCapped(request)
  if (!bytes || bytes.length === 0) return bad()
  const type = pictureType(bytes)
  if (!type) return bad()

  const name = `${id}.${type.extension}`
  await bucket.put(name, bytes, { httpMetadata: { contentType: type.contentType } })
  const imageNow = async () =>
    db.prepare('SELECT image FROM passages WHERE id = ?').bind(id).first<{ image: string | null }>()
  const dropOwn = () => bucket.delete(name).catch((e) => console.error(e))
  const updated = await db
    .prepare('UPDATE passages SET image = ? WHERE id = ? AND image IS ?')
    .bind(name, id, row.image)
    .run()
  if (updated.meta.changes === 0) {
    // Either the passage was deleted meanwhile, or another upload changed the row first.
    const now = await imageNow()
    if (now?.image !== name) await dropOwn()
    return now ? error(409, 'busy') : error(404, 'unknown_passage')
  }
  // The old file goes only if no other upload has put the row back on its name since. A passage deleted just now
  // takes this upload's file with it (its delete only knew the old name).
  const now = await imageNow()
  if (!now) {
    await dropOwn()
  } else if (row.image && row.image !== name && now.image !== row.image) {
    await bucket.delete(row.image).catch((e) => console.error(e))
  }
  return now ? json(200, { image: name }) : error(404, 'unknown_passage')
}
