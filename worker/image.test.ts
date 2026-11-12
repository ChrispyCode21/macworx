// GET /api/reading/image/:name (SPEC §8). The bucket is a fake: no real R2 in tests.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearAccessKeys } from './access'
import { handle, type Env } from './index'
import { createTestDb, DEVICE_KEY } from './test/db'

let t: Awaited<ReturnType<typeof createTestDb>>
let gets: string[]
let lists: number
const BYTES = new Uint8Array([1, 2, 3, 4])

/** Holds `files` (name -> content type or undefined for no metadata); `list` throws, as it must never be called. */
function fakeBucket(files: Record<string, string | undefined>) {
  return {
    async get(key: string, options?: { onlyIf?: Headers }) {
      gets.push(key)
      if (!(key in files)) return null
      const contentType = files[key]
      const httpEtag = `"etag-${key}"`
      const base = { size: BYTES.length, httpEtag, httpMetadata: contentType ? { contentType } : undefined }
      // A conditional get that finds the object unchanged returns it without a body, as R2 does.
      if (options?.onlyIf?.get('If-None-Match') === httpEtag) return base
      return { ...base, body: new Blob([BYTES]).stream() }
    },
    async list() {
      lists++
      throw new Error('the bucket must never be listed')
    },
  } as unknown as R2Bucket
}

beforeEach(async () => {
  clearAccessKeys()
  t = await createTestDb()
  gets = []
  lists = 0
})
afterEach(async () => {
  await t.dispose()
})

const passage = (id: number, image: string | null) =>
  t.db
    .prepare('INSERT INTO passages (id, title, minutes, body, image) VALUES (?, ?, 1, ?, ?)')
    .bind(id, `Story ${id}`, 'One.', image)
    .run()

async function get(
  path: string,
  bucket: R2Bucket | undefined,
  {
    key = DEVICE_KEY,
    method = 'GET',
    ifNoneMatch,
  }: { key?: string | null; method?: string; ifNoneMatch?: string } = {},
) {
  const env: Env = { ...t.env, PASSAGE_IMAGES: bucket }
  const headers: Record<string, string> = {}
  if (key) headers.Authorization = `Bearer ${key}`
  if (ifNoneMatch) headers['If-None-Match'] = ifNoneMatch
  return handle(
    new Request(`https://macworx.test/api/reading/image/${path}`, { method, headers }),
    env,
    new Date('2026-10-17T12:00:00Z'),
    t.certs.fetchCerts,
  )
}

describe('GET /api/reading/image/:name', () => {
  it('refuses a request without a valid key (401), even for a name that does not exist, and reads nothing', async () => {
    await passage(3, '3.webp')
    const bucket = fakeBucket({ '3.webp': 'image/webp' })
    for (const [name, key] of [
      ['3.webp', null],
      ['3.webp', 'wrong-device-key-0123456789abcdef'],
      ['9.webp', null],
      ['abc', null],
    ] as const) {
      const res = await get(name, bucket, { key })
      expect(res.status).toBe(401)
      expect(await res.json()).toEqual({ error: 'unauthorized' })
    }
    expect(gets).toEqual([])
  })

  it("streams a passage's picture with its content type, its ETag, private revalidation and nosniff", async () => {
    await passage(3, '3.webp')
    const res = await get('3.webp', fakeBucket({ '3.webp': 'image/webp' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/webp')
    expect(res.headers.get('Cache-Control')).toBe('private, no-cache')
    expect(res.headers.get('ETag')).toBe('"etag-3.webp"')
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(BYTES)
    expect(gets).toEqual(['3.webp'])
  })

  it('answers 304 with no body when the ETag still matches, and the whole picture when it does not', async () => {
    await passage(3, '3.webp')
    const bucket = fakeBucket({ '3.webp': 'image/webp' })
    const same = await get('3.webp', bucket, { ifNoneMatch: '"etag-3.webp"' })
    expect(same.status).toBe(304)
    expect(same.headers.get('ETag')).toBe('"etag-3.webp"')
    expect(same.headers.get('Cache-Control')).toBe('private, no-cache')
    expect((await same.arrayBuffer()).byteLength).toBe(0)
    const changed = await get('3.webp', bucket, { ifNoneMatch: '"etag-old"' })
    expect(changed.status).toBe(200)
    expect(new Uint8Array(await changed.arrayBuffer())).toEqual(BYTES)
  })

  it('sends the whole picture when R2 will not take the If-None-Match value', async () => {
    await passage(3, '3.webp')
    const picky = {
      async get(key: string, options?: { onlyIf?: Headers }) {
        if (options?.onlyIf) throw new Error('bad condition')
        return { body: new Blob([BYTES]).stream(), size: BYTES.length, httpEtag: `"etag-${key}"` }
      },
    } as unknown as R2Bucket
    const res = await get('3.webp', picky, { ifNoneMatch: 'W/"weird", garbage' })
    expect(res.status).toBe(200)
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(BYTES)
  })

  it('checks the key before it answers 304', async () => {
    await passage(3, '3.webp')
    const res = await get('3.webp', fakeBucket({ '3.webp': 'image/webp' }), {
      key: null,
      ifNoneMatch: '"etag-3.webp"',
    })
    expect(res.status).toBe(401)
  })

  it('takes the content type from the extension when the object has none, and serves any case', async () => {
    await passage(3, '3.webp')
    await passage(4, '4.JPG')
    await passage(5, '5.xyz')
    expect((await get('3.webp', fakeBucket({ '3.webp': undefined }))).headers.get('Content-Type')).toBe(
      'image/webp',
    )
    expect((await get('4.JPG', fakeBucket({ '4.JPG': undefined }))).headers.get('Content-Type')).toBe(
      'image/jpeg',
    )
    expect((await get('5.xyz', fakeBucket({ '5.xyz': undefined }))).headers.get('Content-Type')).toBe(
      'application/octet-stream',
    )
  })

  it('answers 404 for names that are not a passage picture, and never lists the bucket', async () => {
    await passage(3, '3.webp')
    await passage(6, null)
    const bucket = fakeBucket({ '3.webp': 'image/webp', '6.webp': 'image/webp', '9.webp': 'image/webp' })
    for (const name of [
      '9.webp',
      '03.webp',
      '6.webp',
      'abc.webp',
      '3',
      '3.',
      '.webp',
      '..%2F3.webp',
      '3.webp/x',
      '',
    ]) {
      const res = await get(name, bucket)
      expect(res.status, name).toBe(404)
      expect(await res.json()).toEqual({ error: 'not_found' })
    }
    expect(gets).toEqual([])
    expect(lists).toBe(0)
  })

  it('answers 404 for a picture a passage names but R2 does not hold', async () => {
    await passage(3, '3.webp')
    const res = await get('3.webp', fakeBucket({}))
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not_found' })
    expect(lists).toBe(0)
  })

  it('answers 404 rather than throw when the Worker has no bucket', async () => {
    await passage(3, '3.webp')
    const res = await get('3.webp', undefined)
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'not_found' })
  })

  it('answers other methods on the path with 404', async () => {
    await passage(3, '3.webp')
    const res = await get('3.webp', fakeBucket({ '3.webp': 'image/webp' }), { method: 'POST' })
    expect(res.status).toBe(404)
    expect(gets).toEqual([])
  })
})
