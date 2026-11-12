// What a passage picture may be (SPEC §6.10): PNG, JPEG or WebP, up to 2 MB, told by the file's own first bytes and
// not by its name or declared type. The portal checks it before sending and the Worker checks it again.

/** 2 MB: exactly this many bytes are accepted. */
export const MAX_PICTURE = 2 * 1024 * 1024

/** How many leading bytes `pictureType` needs. */
export const PICTURE_HEAD = 12

export interface PictureType {
  extension: 'png' | 'jpg' | 'webp'
  contentType: 'image/png' | 'image/jpeg' | 'image/webp'
}

/** The type a picture's own first bytes call for, or null when they are none of PNG, JPEG and WebP. */
export function pictureType(bytes: Uint8Array): PictureType | null {
  const starts = (...head: number[]) => head.every((byte, i) => bytes[i] === byte)
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))
    return { extension: 'png', contentType: 'image/png' }
  if (starts(0xff, 0xd8, 0xff)) return { extension: 'jpg', contentType: 'image/jpeg' }
  // RIFF, a 4-byte size, then WEBP.
  if (
    bytes.length >= PICTURE_HEAD &&
    starts(0x52, 0x49, 0x46, 0x46) &&
    [0x57, 0x45, 0x42, 0x50].every((b, i) => bytes[8 + i] === b)
  )
    return { extension: 'webp', contentType: 'image/webp' }
  return null
}

/** Why a file can't be used as a picture, or null when it can: its size first, then its first bytes. */
export function pictureProblem(size: number, head: Uint8Array): 'empty' | 'big' | 'type' | null {
  if (size === 0) return 'empty'
  if (size > MAX_PICTURE) return 'big'
  return pictureType(head) ? null : 'type'
}
