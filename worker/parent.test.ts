import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearAccessKeys, parentEmail } from './access'
import { accessToken, AUD, certsWithUnusableKey, KID, ROTATED_KID, TEAM, testCerts } from './test/access-keys'
import { createTestDb, DEVICE_KEY, OTHER_KEY } from './test/db'

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
    const [head, body] = (await accessToken()).split('.')
    expect(await check(`${head}.${body}.abcde`)).toBeNull()
    expect(await check(`${head}.${body}.ab!c`)).toBeNull()
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
  })

  it('verifies with a rotated key once the refetch brings it in', async () => {
    const certs = testCerts((call) => (call === 1 ? [KID] : [KID, ROTATED_KID]))
    const run = (token: string, now: Date) => parentEmail(request(token), env, now, certs.fetchCerts)
    expect(await run(await accessToken(), NOW)).toBe('parent@example.com')
    const later = new Date(NOW.getTime() + 61_000)
    const rotated = await accessToken({ header: { kid: ROTATED_KID }, now: later })
    expect(await run(rotated, later)).toBe('parent@example.com')
  })

  it('refetches the keys after an hour', async () => {
    const certs = testCerts()
    const run = (now: Date) =>
      accessToken({ now }).then((t) => parentEmail(request(t), env, now, certs.fetchCerts))
    await run(NOW)
    await run(new Date(NOW.getTime() + 59 * 60_000))
    expect(certs.calls).toHaveLength(1)
    await run(new Date(NOW.getTime() + 61 * 60_000))
    expect(certs.calls).toHaveLength(2)
  })

  it('a failed key fetch refuses, and waits a minute before trying again', async () => {
    const certs = testCerts((call) => (call === 1 ? new Error('Cloudflare is down') : [KID]))
    const run = (now: Date) =>
      accessToken({ now }).then((t) => parentEmail(request(t), env, now, certs.fetchCerts))
    expect(await run(NOW)).toBeNull()
    expect(await run(new Date(NOW.getTime() + 30_000))).toBeNull()
    expect(certs.calls).toHaveLength(1)
    expect(await run(new Date(NOW.getTime() + 61_000))).toBe('parent@example.com')
  })

  it('skips a key it cannot use instead of refusing everything', async () => {
    const keys = await certsWithUnusableKey()
    const fetchCerts = async () => ({ keys: keys as never })
    expect(await parentEmail(request(await accessToken()), env, NOW, fetchCerts)).toBe('parent@example.com')
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

  it('a wrong method on a parent path is 404 after the Access check', async () => {
    const token = await accessToken()
    expect((await t.call('GET', '/api/parent/devices/1', { key: null, accessToken: token })).status).toBe(404)
    expect((await t.call('POST', '/api/parent/devices', { key: null, accessToken: token })).status).toBe(404)
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

    // Only that iPad: the other one is still paired.
    expect(list.body.devices[1].revokedAt).toBeNull()
    expect((await t.call('GET', '/api/state', { key: OTHER_KEY })).status).toBe(200)

    // And the change is logged with the parent who made it (SPEC §5.3).
    const log = await t.db.prepare('SELECT email, action, detail FROM admin_log').all()
    expect(log.results).toEqual([{ email: 'parent@example.com', action: 'unpair', detail: '{"deviceId":1}' }])
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

  describe('balance adjustments (SPEC §5.3)', () => {
    const adjust = async (body: unknown, token?: string) =>
      t.call('POST', '/api/parent/balance', { key: null, accessToken: token ?? (await accessToken()), body })
    const state = async () =>
      t.db
        .prepare('SELECT balance, streak, last_day, completed FROM child')
        .first<{ balance: number; streak: number; last_day: string | null; completed: number }>()
    const logRows = async () =>
      (await t.db.prepare('SELECT email, action, detail FROM admin_log ORDER BY id').all()).results
    const setUp = () =>
      t.db.prepare("UPDATE child SET balance = 40, streak = 3, last_day = '2026-10-16', completed = 5").run()
    const untouched = { streak: 3, last_day: '2026-10-16', completed: 5 }

    /** Runs the next batch only after another writer got in first, `times` times: a lost race. */
    const raceOnBatch = (times: number, rival: () => Promise<unknown>) => {
      const real = t.env.DB
      let left = times
      t.env.DB = new Proxy(real, {
        get: (target, prop) =>
          prop === 'batch'
            ? async (statements: D1PreparedStatement[]) => {
                if (left-- > 0) await rival()
                return target.batch(statements)
              }
            : Reflect.get(target, prop).bind(target),
      })
      return () => (t.env.DB = real)
    }
    const rivalPays = (n: number) => () =>
      t.db
        .prepare('UPDATE child SET balance = balance + ?, revision = lower(hex(randomblob(16)))')
        .bind(n)
        .run()

    beforeEach(setUp)

    it('B1: adding Macaronis changes only the balance and logs amount, balance before and after, and the note', async () => {
      const { status, body } = await adjust({ amount: 20, note: '  Homework grades ' })
      expect(status).toBe(200)
      expect(body).toEqual({ balance: 60 })
      expect(await state()).toEqual({ balance: 60, ...untouched })
      expect(await logRows()).toEqual([
        {
          email: 'parent@example.com',
          action: 'balance',
          detail: '{"amount":20,"before":40,"after":60,"note":"Homework grades"}',
        },
      ])
      const results = await t.db.prepare('SELECT COUNT(*) AS n FROM results').first<{ n: number }>()
      expect(results?.n).toBe(0)
    })

    it('B2: removing Macaronis takes them off the balance', async () => {
      const { status, body } = await adjust({ amount: -15, note: 'Counted twice' })
      expect(status).toBe(200)
      expect(body).toEqual({ balance: 25 })
      expect(await state()).toMatchObject({ balance: 25 })
      expect(await logRows()).toHaveLength(1)
    })

    it('B3: removing more than her balance is refused, with nothing changed or logged', async () => {
      const { status, body } = await adjust({ amount: -41, note: 'Too many' })
      expect(status).toBe(409)
      expect(body).toEqual({ error: 'overdraw', balance: 40 })
      expect(await state()).toMatchObject({ balance: 40 })
      expect(await logRows()).toEqual([])
    })

    it('B4: removing exactly her balance leaves 0', async () => {
      expect((await adjust({ amount: -40, note: 'All of it' })).body).toEqual({ balance: 0 })
      expect(await state()).toMatchObject({ balance: 0 })
      expect(await logRows()).toHaveLength(1)
    })

    it('B5: a missing, empty, blank or too long note is refused; 200 characters is fine', async () => {
      for (const note of [undefined, '', '   ', 'x'.repeat(201), 7]) {
        const { status, body } = await adjust({ amount: 5, note })
        expect([status, body.error], String(note)).toEqual([400, 'bad_note'])
      }
      expect(await state()).toMatchObject({ balance: 40 })
      expect(await logRows()).toEqual([])
      expect((await adjust({ amount: 5, note: 'x'.repeat(200) })).status).toBe(200)
    })

    it('B6: an amount that is zero, too big, not whole or not a number is refused', async () => {
      for (const amount of [0, 100_001, -100_001, 2.5, '5', null, undefined]) {
        const { status, body } = await adjust({ amount, note: 'ok' })
        expect([status, body.error], String(amount)).toEqual([400, 'bad_amount'])
      }
      expect((await adjust(undefined)).status).toBe(400)
      expect(await state()).toMatchObject({ balance: 40 })
      expect(await logRows()).toEqual([])
      expect((await adjust({ amount: 100_000, note: 'big' })).body).toEqual({ balance: 100_040 })
      expect((await adjust({ amount: -40, note: 'back' })).status).toBe(200)
    })

    it('B7: a result recorded in between is not lost; the adjustment is worked out again', async () => {
      const restore = raceOnBatch(1, rivalPays(10))
      const { status, body } = await adjust({ amount: 20, note: 'Race' })
      restore()
      expect(status).toBe(200)
      expect(body).toEqual({ balance: 70 })
      expect(await state()).toMatchObject({ balance: 70 })
      expect(await logRows()).toEqual([
        expect.objectContaining({ detail: '{"amount":20,"before":50,"after":70,"note":"Race"}' }),
      ])
    })

    it('B8: a removal that is too big once the balance has dropped is refused', async () => {
      const restore = raceOnBatch(1, () =>
        t.db.prepare('UPDATE child SET balance = 5, revision = lower(hex(randomblob(16)))').run(),
      )
      const { status, body } = await adjust({ amount: -30, note: 'Race' })
      restore()
      expect([status, body]).toEqual([409, { error: 'overdraw', balance: 5 }])
      expect(await state()).toMatchObject({ balance: 5 })
      expect(await logRows()).toEqual([])
    })

    it('B9: losing the race three times is 503, with nothing changed or logged by the adjustment', async () => {
      const restore = raceOnBatch(3, rivalPays(1))
      const { status, body } = await adjust({ amount: 20, note: 'Race' })
      restore()
      expect([status, body]).toEqual([503, { error: 'busy' }])
      expect(await state()).toMatchObject({ balance: 43 })
      expect(await logRows()).toEqual([])
    })

    it('B10: without an Access token it is refused', async () => {
      const { status } = await t.call('POST', '/api/parent/balance', {
        key: null,
        body: { amount: 5, note: 'x' },
      })
      expect(status).toBe(401)
      expect(await state()).toMatchObject({ balance: 40 })
    })
  })

  describe('read views (SPEC §5.3)', () => {
    const get = async (path: string) => t.call('GET', path, { key: null, accessToken: await accessToken() })

    const addResult = async (
      seed: number,
      day: string,
      finished: number,
      grade: string | null,
      total: number,
    ) => {
      await t.db
        .prepare('INSERT INTO seeds (seed, device_id, issued_day, used) VALUES (?, 1, ?, 1)')
        .bind(seed, day)
        .run()
      await t.db
        .prepare(
          `INSERT INTO results (seed, device_id, day, answers, answered, correct, finished, grade, base,
             accuracy_bonus, streak_bonus, total, created_at) VALUES (?, 1, ?, '[]', ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
        )
        .bind(
          seed,
          day,
          finished ? 20 : 8,
          finished ? 18 : 7,
          finished,
          grade,
          total,
          total,
          `${day}T12:00:00Z`,
        )
        .run()
    }

    it('the new routes need an Access token too', async () => {
      for (const path of ['summary', 'results', 'log'])
        expect((await t.call('GET', `/api/parent/${path}`, { key: null })).status, path).toBe(401)
    })

    it('the summary shows her totals', async () => {
      await t.db
        .prepare("UPDATE child SET balance = 41, streak = 3, last_day = '2026-10-16', completed = 5")
        .run()
      const { status, body } = await get('/api/parent/summary')
      expect(status).toBe(200)
      expect(body).toEqual({ balance: 41, streak: 3, lastDay: '2026-10-16', completed: 5 })
    })

    it('the summary of a new child has no last counted day', async () => {
      expect((await get('/api/parent/summary')).body).toEqual({
        balance: 0,
        streak: 0,
        lastDay: null,
        completed: 0,
      })
    })

    it('lists results newest first, with a left-early one having no grade', async () => {
      await addResult(1, '2026-10-15', 1, 'Great', 22)
      await addResult(2, '2026-10-17', 0, null, 7)
      await addResult(3, '2026-10-16', 1, 'Excellent', 26)
      const { status, body } = await get('/api/parent/results')
      expect(status).toBe(200)
      expect(body.results.map((r: { day: string }) => r.day)).toEqual([
        '2026-10-17',
        '2026-10-16',
        '2026-10-15',
      ])
      expect(body.results[0]).toEqual({
        id: 2,
        day: '2026-10-17',
        answered: 8,
        correct: 7,
        finished: false,
        grade: null,
        total: 7,
      })
      expect(body.results[1]).toMatchObject({ finished: true, grade: 'Excellent', total: 26 })
    })

    it('lists no more than the latest 50 results', async () => {
      for (let i = 1; i <= 52; i++) await addResult(i, '2026-10-15', 1, 'Good', 10)
      const { body } = await get('/api/parent/results')
      expect(body.results).toHaveLength(50)
      expect(body.results[0].id).toBe(52)
    })

    it('lists the log newest first, with details as an object', async () => {
      const token = await accessToken()
      await t.call('DELETE', '/api/parent/devices/1', { key: null, accessToken: token })
      await t.call('POST', '/api/parent/pairing-code', {
        key: null,
        accessToken: token,
        body: { name: 'Mum' },
      })
      await t.db
        .prepare(
          "INSERT INTO admin_log (at, email, action, detail) VALUES ('x', 'p@example.com', 'odd', 'not json')",
        )
        .run()
      const { status, body } = await get('/api/parent/log')
      expect(status).toBe(200)
      expect(body.entries.map((e: { action: string }) => e.action)).toEqual(['odd', 'pairing_code', 'unpair'])
      expect(body.entries[0].detail).toEqual({})
      expect(body.entries[2]).toMatchObject({
        email: 'parent@example.com',
        at: '2026-10-17T12:00:00.000Z',
        detail: { deviceId: 1 },
      })
    })

    it('the read views change nothing', async () => {
      for (const path of ['summary', 'results', 'log']) await get(`/api/parent/${path}`)
      const log = await t.db.prepare('SELECT COUNT(*) AS n FROM admin_log').first<{ n: number }>()
      expect(log?.n).toBe(0)
    })
  })
})
