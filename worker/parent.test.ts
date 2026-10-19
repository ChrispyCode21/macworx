import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearAccessKeys, parentEmail } from './access'
import { accessToken, AUD, KID, TEAM, testCerts } from './test/access-keys'
import { createTestDb, DEVICE_KEY } from './test/db'

const NOW = new Date('2026-10-17T12:00:00Z')

beforeEach(() => clearAccessKeys())

describe('Access token check (SPEC §6.9)', () => {
  const env = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD }
  const request = (token?: string) =>
    new Request('https://macworx.test/api/parent/devices', {
      headers: token ? { 'Cf-Access-Jwt-Assertion': token } : {},
    })
  const check = async (token?: string, e: Record<string, string | undefined> = env, now = NOW) =>
    parentEmail(request(token), e, now, testCerts().fetchCerts)

  it('accepts a valid token and returns the parent email', async () => {
    expect(await check(await accessToken())).toBe('parent@example.com')
  })

  it('accepts aud as a plain string too', async () => {
    expect(await check(await accessToken({ claims: { aud: AUD } }))).toBe('parent@example.com')
  })

  it.each([
    ['another app', { claims: { aud: ['someone-else'] } }],
    ['another team', { claims: { iss: 'https://evil.cloudflareaccess.com' } }],
    ['expired', { claims: { exp: Math.floor(NOW.getTime() / 1000) - 120 } }],
    ['not valid yet', { claims: { nbf: Math.floor(NOW.getTime() / 1000) + 600 } }],
    ['no email', { claims: { email: '' } }],
    ['another algorithm', { header: { alg: 'HS256' } }],
    ['an unknown key', { header: { kid: 'not-our-key' } }],
  ])('refuses a token for %s', async (_, override) => {
    expect(await check(await accessToken(override))).toBeNull()
  })

  it('refuses a token whose signature does not match', async () => {
    const [head, , sig] = (await accessToken()).split('.')
    const forged = (await accessToken({ claims: { email: 'intruder@example.com' } })).split('.')[1]
    expect(await check(`${head}.${forged}.${sig}`)).toBeNull()
  })

  it('refuses a missing or malformed token', async () => {
    expect(await check()).toBeNull()
    expect(await check('not-a-token')).toBeNull()
    expect(await check('a.b.c')).toBeNull()
  })

  it('fails closed when the Worker has no Access settings (PR previews)', async () => {
    const token = await accessToken()
    expect(await check(token, {})).toBeNull()
    expect(await check(token, { ACCESS_TEAM_DOMAIN: TEAM })).toBeNull()
    expect(await check(token, { ACCESS_AUD: AUD })).toBeNull()
  })

  it('caches the team keys, and an unknown key refetches at most once a minute', async () => {
    const certs = testCerts()
    const run = async (token: string, now = NOW) => parentEmail(request(token), env, now, certs.fetchCerts)
    await run(await accessToken())
    await run(await accessToken())
    expect(certs.calls).toHaveLength(1)
    const unknown = await accessToken({ header: { kid: 'rotated' } })
    await run(unknown)
    await run(unknown)
    expect(certs.calls).toHaveLength(1)
    await run(unknown, new Date(NOW.getTime() + 61_000))
    expect(certs.calls).toHaveLength(2)
    expect(certs.calls[0]).toBe(`https://${TEAM}/cdn-cgi/access/certs`)
    expect(KID).toBe('test-key-1')
  })
})

describe('parent API', () => {
  let t: Awaited<ReturnType<typeof createTestDb>>
  beforeEach(async () => {
    t = await createTestDb()
  })
  afterEach(async () => {
    await t.dispose()
  })

  it('A6: a parent route without a valid Access token → 401', async () => {
    expect((await t.call('GET', '/api/parent/devices', { key: null })).status).toBe(401)
    const expired = await accessToken({ claims: { exp: 1 } })
    expect((await t.call('GET', '/api/parent/devices', { key: null, accessToken: expired })).status).toBe(401)
    // A device key is no substitute for Access, and unknown parent paths are 401 too, not 404.
    expect((await t.call('GET', '/api/parent/devices')).status).toBe(401)
    expect((await t.call('GET', '/api/parent/nothing-here', { key: null })).status).toBe(401)
  })

  it('A6: with the Worker’s Access settings missing → 401 even with a valid token', async () => {
    const preview = await createTestDb({ access: false })
    const token = await accessToken()
    expect((await preview.call('GET', '/api/parent/devices', { key: null, accessToken: token })).status).toBe(
      401,
    )
    await preview.dispose()
  })

  it('lists the paired iPads', async () => {
    const { status, body } = await t.call('GET', '/api/parent/devices', {
      key: null,
      accessToken: await accessToken(),
    })
    expect(status).toBe(200)
    expect(body.devices.map((d: { label: string }) => d.label)).toEqual(['her iPad', 'another iPad'])
    expect(body.devices[0]).toMatchObject({ id: 1, revokedAt: null })
  })

  it('A5: after a parent unpairs an iPad, its key is refused on every child route', async () => {
    const token = await accessToken()
    expect((await t.call('GET', '/api/state')).status).toBe(200)
    const unpair = await t.call('DELETE', '/api/parent/devices/1', { key: null, accessToken: token })
    expect(unpair.status).toBe(200)
    for (const [method, path] of [
      ['GET', '/api/state'],
      ['POST', '/api/seeds'],
      ['POST', '/api/results'],
    ])
      expect((await t.call(method, path, { key: DEVICE_KEY })).status, path).toBe(401)
    const list = await t.call('GET', '/api/parent/devices', { key: null, accessToken: token })
    expect(list.body.devices[0].revokedAt).toBe('2026-10-17T12:00:00.000Z')
  })

  it('unpairing twice keeps the first time, and an unknown iPad is 404', async () => {
    const token = await accessToken()
    await t.call('DELETE', '/api/parent/devices/1', { key: null, accessToken: token })
    const again = await t.call('DELETE', '/api/parent/devices/1', {
      key: null,
      accessToken: await accessToken({ now: new Date('2026-10-18T12:00:00Z') }),
      now: new Date('2026-10-18T12:00:00Z'),
    })
    expect(again.status).toBe(200)
    const list = await t.call('GET', '/api/parent/devices', { key: null, accessToken: token })
    expect(list.body.devices[0].revokedAt).toBe('2026-10-17T12:00:00.000Z')
    expect((await t.call('DELETE', '/api/parent/devices/99', { key: null, accessToken: token })).status).toBe(
      404,
    )
  })
})
