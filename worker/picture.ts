// Uploading a passage's picture from the parent portal (SPEC §6.10, §8). The Access token is already checked.
import { error, json } from './http'
import type { ParentRequest } from './parent-request'

/** 2 MB: exactly this many bytes are accepted (SPEC §6.10). */
export const MAX_PICTURE = 2 * 1024 * 1024

const bad = () => error(400, 'bad_image')

/** The type a picture's own first bytes call for, or null when they are none of PNG, JPEG and WebP. */
export function pictureType(bytes: Uint8Array): { extension: string; contentType: string } | null {
  const starts = (...head: number[]) => head.every((byte, i) => bytes[i] === byte)
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
    return { extension: 'png', contentType: 'image/png' }
  if (starts(0xff, 0xd8, 0xff)) return { extension: 'jpg', contentType: 'image/jpeg' }
  // RIFF, a 4-byte size, then WEBP.
  if (
    bytes.length >= 12 &&
    starts(0x52, 0x49, 0x46, 0x46) &&
    [0x57, 0x45, 0x42, 0x50].every((b, i) => bytes[8 + i] === b)
  )
    return { extension: 'webp', contentType: 'image/webp' }
  return null
}

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
 * two leaves a file nobody can reach and never a row pointing at nothing; the old file goes last.
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
  const updated = await db.prepare('UPDATE passages SET image = ? WHERE id = ?').bind(name, id).run()
  if (updated.meta.changes === 0) {
    // The passage was deleted meanwhile: its picture goes too.
    await bucket.delete(name).catch((e) => console.error(e))
    return error(404, 'unknown_passage')
  }
  // The old file goes only if no other upload has put the row back on its name since.
  if (row.image && row.image !== name) {
    const now = await db
      .prepare('SELECT image FROM passages WHERE id = ?')
      .bind(id)
      .first<{ image: string | null }>()
    if (now?.image !== row.image) await bucket.delete(row.image).catch((e) => console.error(e))
  }
  return json(200, { image: name })
}
