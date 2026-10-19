import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearAccessKeys } from './access'
import { accessToken } from './test/access-keys'
import { createTestDb } from './test/db'

let t: Awaited<ReturnType<typeof createTestDb>>
let parent: string
beforeEach(async () => {
  clearAccessKeys()
  t = await createTestDb()
  parent = await accessToken()
})
afterEach(async () => {
  await t.dispose()
})

const NOW = new Date('2026-10-17T12:00:00Z')
const minutesLater = (m: number) => new Date(NOW.getTime() + m * 60_000)

async function makeCode(name = 'Her iPad', now = NOW) {
  const { status, body } = await t.call('POST', '/api/parent/pairing-code', {
    key: null,
    accessToken: await accessToken({ now }),
    body: { name },
    now,
  })
  return { status, code: body.code as string, expiresAt: body.expiresAt as string }
}
const pair = (code: unknown, now = NOW) => t.call('POST', '/api/pair', { key: null, body: { code }, now })
const wrong = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, '0')
const deviceCount = async () =>
  (await t.db.prepare('SELECT COUNT(*) AS n FROM devices').first<{ n: number }>())!.n

describe('pairing (SPEC §6.9)', () => {
  it('A1: a code named "Her iPad", sent within 10 minutes → paired, and the key works on child routes', async () => {
    const { status, code, expiresAt } = await makeCode('Her iPad')
    expect(status).toBe(201)
    expect(code).toMatch(/^\d{6}$/)
    expect(expiresAt).toBe('2026-10-17T12:10:00.000Z')

    const paired = await pair(code, minutesLater(9))
    expect(paired.status).toBe(201)
    expect(paired.body.key).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect((await t.call('GET', '/api/state', { key: paired.body.key })).status).toBe(200)

    const list = await t.call('GET', '/api/parent/devices', { key: null, accessToken: parent })
    expect(list.body.devices.at(-1).label).toBe('Her iPad')
    // Only the key's SHA-256 is stored, never the key.
    const stored = await t.db
      .prepare('SELECT key_hash FROM devices ORDER BY id DESC LIMIT 1')
      .first<{ key_hash: string }>()
    expect(stored!.key_hash).not.toContain(paired.body.key)
  })

  it('A2: the same code sent again → refused, no second device', async () => {
    const { code } = await makeCode()
    await pair(code)
    const before = await deviceCount()
    const again = await pair(code)
    expect(again).toEqual({ status: 400, body: { error: 'bad_code' } })
    expect(await deviceCount()).toBe(before)
  })

  it('A3: the code sent 11 minutes after it was made → refused', async () => {
    const { code } = await makeCode()
    expect((await pair(code, minutesLater(11))).status).toBe(400)
  })

  it('A4: five wrong codes, then the right one → all refused', async () => {
    const { code } = await makeCode()
    for (let i = 0; i < 5; i++) expect((await pair(wrong(code))).status).toBe(400)
    expect((await pair(code)).status).toBe(400)
    const before = await deviceCount()
    expect(before).toBe(2) // the two test devices only
  })

  it('A4: a burst of wrong guesses at once still counts every one; the code is void after five', async () => {
    const { code } = await makeCode()
    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        pair(String(i).padStart(6, '0') === code ? wrong(code) : String(i).padStart(6, '0')),
      ),
    )
    const row = await t.db
      .prepare('SELECT attempts, voided_at FROM pairing_codes')
      .first<{ attempts: number; voided_at: string | null }>()
    expect(row!.attempts).toBe(5)
    expect(row!.voided_at).not.toBeNull()
    expect((await pair(code)).status).toBe(400)
  })

  it('a right code sent twice at once pairs exactly one iPad', async () => {
    const { code } = await makeCode()
    const before = await deviceCount()
    const results = await Promise.all([pair(code), pair(code), pair(code)])
    expect(results.filter((r) => r.status === 201)).toHaveLength(1)
    expect(await deviceCount()).toBe(before + 1)
  })

  it('a new code voids an earlier unused one', async () => {
    const first = await makeCode('First')
    const second = await makeCode('Second')
    expect((await pair(first.code)).status).toBe(400)
    expect((await pair(second.code)).status).toBe(201)
  })

  it('refuses everything the same way, so a guess learns nothing', async () => {
    for (const code of ['123456', '12345', 'abcdef', 123456, undefined]) {
      expect(await pair(code), String(code)).toEqual({ status: 400, body: { error: 'bad_code' } })
    }
  })

  it('a pairing code needs a parent: no Access token → 401', async () => {
    const { status } = await t.call('POST', '/api/parent/pairing-code', { key: null, body: { name: 'x' } })
    expect(status).toBe(401)
  })

  it('needs a name of 1 to 40 characters', async () => {
    for (const name of ['', '   ', 'x'.repeat(41)]) expect((await makeCode(name)).status, name).toBe(400)
    expect((await makeCode('x'.repeat(40))).status).toBe(201)
  })

  it('logs each code a parent makes, with the name', async () => {
    await makeCode('Her iPad')
    const log = await t.db.prepare('SELECT email, action, detail FROM admin_log').all()
    expect(log.results).toEqual([
      { email: 'parent@example.com', action: 'pairing_code', detail: '{"name":"Her iPad"}' },
    ])
  })

  it('codes are spread across all six digits', async () => {
    const codes = new Set<string>()
    for (let i = 0; i < 20; i++) codes.add((await makeCode(`iPad ${i}`)).code)
    expect(codes.size).toBeGreaterThan(15)
  })
})
