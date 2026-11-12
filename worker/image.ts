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
  ifNoneMatch = null,
}: {
  db: D1Database
  bucket: R2Bucket | undefined
  name: string
  /** The request's If-None-Match, so an unchanged picture answers 304. */
  ifNoneMatch?: string | null
}): Promise<Response> {
  if (!bucket || !NAME.test(name)) return error(404, 'not_found')
  const known = await db.prepare('SELECT 1 AS ok FROM passages WHERE image = ?').bind(name).first()
  if (!known) return error(404, 'not_found')
  // A value R2 can't use as a condition is no reason to fail: the picture is simply sent whole.
  const object = await (ifNoneMatch
    ? bucket
        .get(name, { onlyIf: new Headers({ 'If-None-Match': ifNoneMatch }) })
        .catch(() => bucket.get(name))
    : bucket.get(name))
  if (!object) return error(404, 'not_found')
  // A replaced picture keeps its name, so it is revalidated on each use rather than trusted for a year.
  const revalidate = {
    ETag: object.httpEtag,
    'Cache-Control': 'private, no-cache',
    'X-Content-Type-Options': 'nosniff',
  }
  // The conditional get found it unchanged: an object without a body.
  if (!('body' in object)) return new Response(null, { status: 304, headers: revalidate })
  const extension = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
  const type =
    object.httpMetadata?.contentType ??
    (Object.prototype.hasOwnProperty.call(TYPES, extension) ? TYPES[extension] : undefined) ??
    'application/octet-stream'
  return new Response(object.body, {
    headers: {
      'Content-Type': type,
      ...revalidate,
    },
  })
}
