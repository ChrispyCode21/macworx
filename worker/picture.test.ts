// PUT /api/parent/passages/:id/image (SPEC §6.10, §8, L23). The bucket is a fake: no real R2 in tests.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearAccessKeys } from './access'
import { handle } from './index'
import { MAX_PICTURE, pictureType } from './picture'
import { accessToken } from './test/access-keys'
import { createTestDb } from './test/db'

let t: Awaited<ReturnType<typeof createTestDb>>
let token: string
let files: Map<string, { bytes: Uint8Array; contentType: string | undefined }>
let deletes: string[]

function fakeBucket() {
  return {
    async put(key: string, value: Uint8Array, options?: R2PutOptions) {
      files.set(key, { bytes: value, contentType: (options?.httpMetadata as R2HTTPMetadata)?.contentType })
    },
    async delete(key: string) {
      deletes.push(key)
      files.delete(key)
    },
    async list() {
      throw new Error('the bucket must never be listed')
    },
  } as unknown as R2Bucket
}

beforeEach(async () => {
  clearAccessKeys()
  t = await createTestDb()
  token = await accessToken()
  files = new Map()
  deletes = []
  t.env.PASSAGE_IMAGES = fakeBucket()
})
afterEach(async () => {
  await t.dispose()
})

const png = (extra = 8) =>
  new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(extra).fill(7)])
const jpg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46])
const webp = () => new Uint8Array([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56])
const text = new TextEncoder().encode('hello, I am not a picture')

const passage = (id: number, image: string | null = null) =>
  t.db
    .prepare('INSERT INTO passages (id, title, minutes, body, image) VALUES (?, ?, 1, ?, ?)')
    .bind(id, `Story ${id}`, 'One.', image)
    .run()
const imageOf = async (id: number) =>
  (await t.db.prepare('SELECT image FROM passages WHERE id = ?').bind(id).first<{ image: string | null }>())!
    .image

function put(
  id: number,
  body: BodyInit | null,
  headers: Record<string, string> = {},
  signed = true,
  stream = false,
) {
  return handle(
    new Request(`https://macworx.test/api/parent/passages/${id}/image?child=1`, {
      method: 'PUT',
      headers: { ...(signed ? { 'Cf-Access-Jwt-Assertion': token } : {}), ...headers },
      body,
      ...(stream ? { duplex: 'half' } : {}),
    } as RequestInit),
    t.env,
    new Date('2026-10-17T12:00:00Z'),
    t.certs.fetchCerts,
  )
}

describe('pictureType', () => {
  it('reads PNG, JPEG and WebP from the first bytes, and nothing else', () => {
    expect(pictureType(png())?.extension).toBe('png')
    expect(pictureType(jpg())?.extension).toBe('jpg')
    expect(pictureType(webp())?.extension).toBe('webp')
    expect(pictureType(text)).toBeNull()
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

describe('PUT /api/parent/passages/:id/image', () => {
  it('stores a picture as <id>.<extension> from its bytes, whatever the declared type', async () => {
    await passage(3)
    const res = await put(3, jpg(), { 'Content-Type': 'image/png' })
    expect([res.status, await res.json()]).toEqual([200, { image: '3.jpg' }])
    expect(await imageOf(3)).toBe('3.jpg')
    expect(files.get('3.jpg')).toMatchObject({ contentType: 'image/jpeg' })
    expect([...files.get('3.jpg')!.bytes]).toEqual([...jpg()])
  })

  it('L23: bytes that are not PNG, JPEG or WebP are refused (400) and nothing is stored, even named a.png', async () => {
    await passage(3)
    const res = await put(3, text, { 'Content-Type': 'image/png', 'X-File-Name': 'a.png' })
    expect([res.status, await res.json()]).toEqual([400, { error: 'bad_image' }])
    expect(await imageOf(3)).toBeNull()
    expect(files.size).toBe(0)
  })

  it('L23: an empty body and one over 2 MB are refused (400) and nothing is stored', async () => {
    await passage(3)
    expect((await put(3, new Uint8Array())).status).toBe(400)
    const big = new Uint8Array(MAX_PICTURE + 1)
    big.set(png())
    expect((await put(3, big)).status).toBe(400)
    expect(await imageOf(3)).toBeNull()
    expect(files.size).toBe(0)
  })

  it('L23: a header that says the body is small does not let more through', async () => {
    await passage(3)
    const big = new Uint8Array(MAX_PICTURE + 1)
    big.set(png())
    expect((await put(3, big, { 'Content-Length': '100' })).status).toBe(400)
    expect(files.size).toBe(0)
  })

  it('accepts exactly 2 MB', async () => {
    await passage(3)
    const exact = new Uint8Array(MAX_PICTURE)
    exact.set(png())
    const res = await put(3, exact)
    expect(res.status).toBe(200)
    expect(files.get('3.png')!.bytes.length).toBe(MAX_PICTURE)
  })

  it('a new picture replaces the old: the same type keeps one file, another type removes the old one', async () => {
    await passage(3)
    await put(3, png())
    await put(3, png(20))
    expect([...files.keys()]).toEqual(['3.png'])
    expect(files.get('3.png')!.bytes.length).toBe(8 + 20)
    expect(deletes).toEqual([])

    await put(3, webp())
    expect(await imageOf(3)).toBe('3.webp')
    expect([...files.keys()].sort()).toEqual(['3.webp'])
    expect(deletes).toEqual(['3.png'])
  })

  it('answers 404 for a passage that is not there, and stores nothing', async () => {
    const res = await put(9, png())
    expect([res.status, await res.json()]).toEqual([404, { error: 'unknown_passage' }])
    expect(files.size).toBe(0)
  })

  it('answers 503 and stores nothing when the Worker has no picture store', async () => {
    await passage(3)
    t.env.PASSAGE_IMAGES = undefined
    const res = await put(3, png())
    expect([res.status, await res.json()]).toEqual([503, { error: 'no_picture_store' }])
    expect(await imageOf(3)).toBeNull()
  })

  it('removes the file it stored when the passage was deleted meanwhile', async () => {
    await passage(3)
    const real = t.env.DB
    // The passage is deleted after the Worker has stored the picture and before it updates the row.
    t.env.DB = new Proxy(real, {
      get(target, prop) {
        if (prop !== 'prepare') return (target as any)[prop].bind?.(target) ?? (target as any)[prop]
        return (sql: string) => {
          if (sql.startsWith('UPDATE passages SET image')) {
            const statement = target.prepare(sql)
            return {
              bind: (...values: unknown[]) => ({
                run: async () => {
                  await target.prepare('DELETE FROM passages WHERE id = 3').run()
                  return statement.bind(...values).run()
                },
              }),
            }
          }
          return target.prepare(sql)
        }
      },
    })
    const res = await put(3, png())
    expect(res.status).toBe(404)
    expect(files.size).toBe(0)
  })

  it('does not delete the old file when another upload has put the row back on its name', async () => {
    await passage(3, '3.png')
    files.set('3.png', { bytes: png(), contentType: 'image/png' })
    const real = t.env.DB
    // While this upload (a WebP) is between its update and its look at the row, a PNG upload lands.
    let first = true
    t.env.DB = new Proxy(real, {
      get(target, prop) {
        if (prop !== 'prepare') return (target as any)[prop].bind?.(target) ?? (target as any)[prop]
        return (sql: string) => {
          const statement = target.prepare(sql)
          if (!sql.startsWith('SELECT image') || first) {
            if (sql.startsWith('SELECT image')) first = false
            return statement
          }
          return {
            bind: (...values: unknown[]) => ({
              first: async () => {
                await target.prepare("UPDATE passages SET image = '3.png' WHERE id = 3").run()
                return statement.bind(...values).first()
              },
            }),
          }
        }
      },
    })
    const res = await put(3, webp())
    expect(res.status).toBe(200)
    expect(deletes).toEqual([])
    expect(files.has('3.png')).toBe(true)
  })

  it('two uploads at once of different types leave the row on a file that exists, and the loser is told to retry', async () => {
    await passage(3, '3.png')
    files.set('3.png', { bytes: png(), contentType: 'image/png' })
    // B (a PNG) has read the row and is waiting for its body; A (a WebP) runs through meanwhile.
    let release!: () => void
    const gate = new Promise<void>((resolve) => (release = resolve))
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        await gate
        controller.enqueue(png(30))
        controller.close()
      },
    })
    const slow = put(3, body as unknown as BodyInit, { 'Content-Type': 'image/png' }, true, true)
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect((await put(3, webp())).status).toBe(200)
    release()
    const loser = await slow
    expect([loser.status, await loser.json()]).toEqual([409, { error: 'busy' }])
    expect(await imageOf(3)).toBe('3.webp')
    expect([...files.keys()]).toEqual(['3.webp'])
  })

  it('takes back its own file, and says 404, when the passage is deleted just after the row was updated', async () => {
    await passage(3, '3.png')
    files.set('3.png', { bytes: png(), contentType: 'image/png' })
    const real = t.env.DB
    // The row is deleted after this upload's update, before it looks at the row again.
    t.env.DB = new Proxy(real, {
      get(target, prop) {
        if (prop !== 'prepare') return (target as any)[prop].bind?.(target) ?? (target as any)[prop]
        return (sql: string) => {
          const statement = target.prepare(sql)
          if (!sql.startsWith('UPDATE passages SET image')) return statement
          return {
            bind: (...values: unknown[]) => ({
              run: async () => {
                const done = await statement.bind(...values).run()
                await target.prepare('DELETE FROM passages WHERE id = 3').run()
                return done
              },
            }),
          }
        }
      },
    })
    const res = await put(3, webp())
    expect(res.status).toBe(404)
    expect(files.has('3.webp')).toBe(false)
  })

  it('needs an Access token like every parent route', async () => {
    await passage(3)
    const res = await put(3, png(), {}, false)
    expect(res.status).toBe(401)
    expect(files.size).toBe(0)
  })
})
