// Passage pictures from R2 (SPEC §6.10, §8). The caller has already checked the device key.
import { error } from './http'

/** A picture name is a passage id and an extension, for example `3.webp`. */
const NAME = /^[0-9]+\.[A-Za-z0-9]+$/

const TYPES: Record<string, string> = {
  webp: 'image/webp',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  avif: 'image/avif',
}

/**
 * The picture named `name` (still percent-encoded, as it sits in the path), or 404 `not_found` for a name no
 * passage holds, a picture missing from R2, or a Worker with no bucket. The bucket is never listed.
 */
export async function getReadingImage({
  db,
  bucket,
  name,
}: {
  db: D1Database
  bucket: R2Bucket | undefined
  name: string
}): Promise<Response> {
  if (!bucket || !NAME.test(name)) return error(404, 'not_found')
  const known = await db.prepare('SELECT 1 AS ok FROM passages WHERE image = ?').bind(name).first()
  if (!known) return error(404, 'not_found')
  const object = await bucket.get(name)
  if (!object) return error(404, 'not_found')
  const type =
    object.httpMetadata?.contentType ??
    TYPES[name.slice(name.lastIndexOf('.') + 1).toLowerCase()] ??
    'application/octet-stream'
  return new Response(object.body, {
    headers: {
      'Content-Type': type,
      'Cache-Control': 'private, max-age=31536000',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
