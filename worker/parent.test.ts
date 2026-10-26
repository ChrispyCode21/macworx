import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearAccessKeys, parentEmail } from './access'
import { accessToken, AUD, certsWithUnusableKey, KID, ROTATED_KID, TEAM, testCerts } from './test/access-keys'
import { generateAssignment } from '../src/engine'
import { postStreak } from './parent'
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

  describe('streak edits (SPEC §5.3)', () => {
    const set = async (body: unknown) =>
      t.call('POST', '/api/parent/streak', { key: null, accessToken: await accessToken(), body })
    const child = () =>
      t.db.prepare('SELECT balance, streak, last_day, completed FROM child').first<Record<string, unknown>>()
    const logRows = async () =>
      (await t.db.prepare('SELECT email, action, detail FROM admin_log ORDER BY id').all()).results
    const START = { balance: 40, streak: 3, last_day: '2026-10-16', completed: 5 }
    beforeEach(async () => {
      await t.db
        .prepare("UPDATE child SET balance = 40, streak = 3, last_day = '2026-10-16', completed = 5")
        .run()
    })
    /** Refused with `code`: nothing changed and nothing logged. */
    const refused = async (body: unknown, code: string) => {
      const res = await set(body)
      expect(res, JSON.stringify(body)).toEqual({ status: 400, body: { error: code } })
      expect(await child()).toEqual(START)
      expect(await logRows()).toEqual([])
    }
    /** The route run directly, with `beforeBatch` called before each batch, to stand in for a racing write. */
    const raced = (beforeBatch: () => Promise<void>) => {
      const db = {
        prepare: (sql: string) => t.db.prepare(sql),
        batch: async (statements: D1PreparedStatement[]) => {
          await beforeBatch()
          return t.db.batch(statements)
        },
      } as unknown as D1Database
      return postStreak({
        request: new Request('https://macworx.test/api/parent/streak', {
          method: 'POST',
          body: JSON.stringify({ streak: 7, lastDay: '2026-10-16' }),
        }),
        url: new URL('https://macworx.test/api/parent/streak'),
        db,
        email: 'parent@example.com',
        now: NOW,
        params: {},
      })
    }

    it('C1: sets streak 7 and day 2026-10-16 → saved, balance and completed untouched, logged', async () => {
      await t.db
        .prepare(
          `INSERT INTO seeds (seed, device_id, issued_day, used) VALUES (1, 1, '2026-10-16', 1)`,
        )
        .run()
      await t.db
        .prepare(
          `INSERT INTO results (seed, device_id, day, answers, answered, correct, finished, grade, base,
             accuracy_bonus, streak_bonus, total, created_at) VALUES (1, 1, '2026-10-16', '[]', 20, 20, 1,
             'Excellent', 20, 4, 3, 27, '2026-10-16T12:00:00Z')`,
        )
        .run()
      const { status, body } = await set({ streak: 7, lastDay: '2026-10-16' })
      expect(status).toBe(200)
      expect(body).toEqual({ balance: 40, streak: 7, lastDay: '2026-10-16', completed: 5 })
      expect(await child()).toEqual({ ...START, streak: 7 })
      const results = await t.db.prepare('SELECT COUNT(*) AS n, SUM(total) AS sum FROM results').first()
      expect(results).toEqual({ n: 1, sum: 27 })
      const rows = await logRows()
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ email: 'parent@example.com', action: 'streak' })
      expect(JSON.parse(rows[0].detail as string)).toEqual({
        before: { streak: 3, lastDay: '2026-10-16' },
        after: { streak: 7, lastDay: '2026-10-16' },
      })
    })

    it('C2: streak 0 with an empty day (empty string or null) → no last counted day, logged', async () => {
      expect((await set({ streak: 0, lastDay: '' })).status).toBe(200)
      expect(await child()).toEqual({ ...START, streak: 0, last_day: null })
      await t.db.prepare("UPDATE child SET streak = 3, last_day = '2026-10-16'").run()
      expect((await set({ streak: 0, lastDay: null })).status).toBe(200)
      expect(await child()).toEqual({ ...START, streak: 0, last_day: null })
      expect(await logRows()).toHaveLength(2)
    })

    it('C3: an empty day with streak 3 → 400, nothing changed or logged', async () => {
      await refused({ streak: 3, lastDay: '' }, 'bad_day')
      await refused({ streak: 3, lastDay: null }, 'bad_day')
    })

    it('C4: day 2026-10-18 is accepted, 2026-10-19 is refused', async () => {
      await refused({ streak: 3, lastDay: '2026-10-19' }, 'bad_day')
      expect((await set({ streak: 3, lastDay: '2026-10-18' })).status).toBe(200)
      expect((await child())?.last_day).toBe('2026-10-18')
    })

    it('C5: a streak of -1, 3651, 2.5, "5" or missing → 400; 0 and 3650 are accepted', async () => {
      for (const streak of [-1, 3651, 2.5, '5', undefined, null])
        await refused({ streak, lastDay: '2026-10-16' }, 'bad_streak')
      await refused('nope', 'bad_streak')
      expect((await set({ streak: 0, lastDay: '2026-10-16' })).status).toBe(200)
      expect((await set({ streak: 3650, lastDay: '2026-10-16' })).status).toBe(200)
      expect((await child())?.streak).toBe(3650)
    })

    it('C6: a bad or missing day → 400; an earlier real day is accepted', async () => {
      for (const lastDay of ['2026-02-30', '10/16/2026', 20261016, undefined, '2026-10-16T00:00', ' 2026-10-16'])
        await refused({ streak: 3, lastDay }, 'bad_day')
      expect((await set({ streak: 3, lastDay: '2026-01-05' })).status).toBe(200)
      expect((await child())?.last_day).toBe('2026-01-05')
    })

    it('C7: a result recorded between the read and the write → worked out again from the new row', async () => {
      let first = true
      const res = await raced(async () => {
        if (!first) return
        first = false
        // What recording a result does: new balance, completed, streak, day and revision.
        await t.db
          .prepare(
            "UPDATE child SET balance = 65, completed = 6, streak = 4, last_day = '2026-10-17', revision = 'other'",
          )
          .run()
      })
      expect(res.status).toBe(200)
      expect(await child()).toEqual({ balance: 65, streak: 7, last_day: '2026-10-16', completed: 6 })
      const rows = await logRows()
      expect(rows).toHaveLength(1)
      expect(JSON.parse(rows[0].detail as string).before).toEqual({ streak: 4, lastDay: '2026-10-17' })
    })

    it('C8: losing the race three times → 503, nothing changed or logged', async () => {
      let n = 0
      const res = await raced(async () => {
        await t.db.prepare('UPDATE child SET revision = ?').bind(`other-${n++}`).run()
      })
      expect(res.status).toBe(503)
      expect(await res.json()).toEqual({ error: 'busy' })
      expect(n).toBe(3)
      expect(await child()).toEqual(START)
      expect(await logRows()).toEqual([])
    })

    it('C9: no Access token → 401', async () => {
      const body = { streak: 7, lastDay: '2026-10-16' }
      expect((await t.call('POST', '/api/parent/streak', { key: null, body })).status).toBe(401)
      expect((await t.call('POST', '/api/parent/streak', { body })).status).toBe(401)
      expect(await child()).toEqual(START)
    })

    it('C10: after the edit, the next finished result continues from it and the edit paid nothing', async () => {
      await set({ streak: 7, lastDay: '2026-10-16' })
      expect((await child())?.balance).toBe(40)
      const { body: seeds } = await t.call('POST', '/api/seeds')
      const seed = seeds.seeds[0] as number
      const answers = generateAssignment(seed).map((p) => p.answer)
      const { status, body } = await t.call('POST', '/api/results', {
        body: { seed, day: '2026-10-17', answers },
      })
      expect(status).toBe(201)
      expect(body.result.payout).toMatchObject({ base: 20, accuracyBonus: 4, streakBonus: 8, total: 32 })
      expect(body.state).toMatchObject({ balance: 72, streak: 8, lastDay: '2026-10-17', completed: 6 })
    })
  })
})
