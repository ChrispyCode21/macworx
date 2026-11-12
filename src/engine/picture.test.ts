import { describe, expect, it } from 'vitest'
import { MAX_PICTURE, pictureProblem, pictureType } from './picture'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 7, 7])
const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46])
const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56])

describe('pictureType', () => {
  it('reads PNG, JPEG and WebP from the first bytes, and nothing else', () => {
    expect(pictureType(png)?.extension).toBe('png')
    expect(pictureType(jpg)?.extension).toBe('jpg')
    expect(pictureType(webp)?.extension).toBe('webp')
    expect(pictureType(new TextEncoder().encode('hello, I am not a picture'))).toBeNull()
    expect(pictureType(new Uint8Array())).toBeNull()
    // RIFF but not WebP (a WAV), and a RIFF header that stops short.
    expect(
      pictureType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x41, 0x56, 0x45])),
    ).toBeNull()
    expect(pictureType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45]))).toBeNull()
    // GIF is not on the list.
    expect(pictureType(new TextEncoder().encode('GIF89a....'))).toBeNull()
  })
})

describe('pictureProblem', () => {
  it('names an empty file, one over 2 MB and one that is not a picture, and lets exactly 2 MB through', () => {
    expect(pictureProblem(0, png)).toBe('empty')
    expect(pictureProblem(MAX_PICTURE + 1, png)).toBe('big')
    expect(pictureProblem(100, new TextEncoder().encode('not a picture'))).toBe('type')
    expect(pictureProblem(MAX_PICTURE, png)).toBeNull()
    expect(pictureProblem(100, webp)).toBeNull()
  })
})
