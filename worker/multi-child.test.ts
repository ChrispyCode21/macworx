// Two children in one household: no parent or child route reads or writes the other child's data (#81).
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearAccessKeys } from './access'
import { generateAssignment } from '../src/engine'
import { accessToken } from './test/access-keys'
import { CHILD2_KEY, createTestDb, DEVICE_KEY } from './test/db'

let t: Awaited<ReturnType<typeof createTestDb>>
let token: string
beforeEach(async () => {
  clearAccessKeys()
  t = await createTestDb()
  token = await accessToken()
})
afterEach(async () => {
  await t.dispose()
})

const at = (day: string) => new Date(`${day}T12:00:00Z`)
const parent = (method: string, path: string, body?: unknown, child: number | null = 1) =>
  t.call(method, path, { key: null, accessToken: token, body, child })

/** Records a finished 20-of-20 result from the device with `key`, on `day`. */
async function finish(key: string, day = '2026-10-17', correct = 20) {
  const { body } = await t.call('POST', '/api/seeds', { key, now: at(day) })
  const seed = body.seeds[0] as number
  const answers = generateAssignment(seed).map((p, i) => (i < correct ? p.answer : p.answer + 1))
  return t.call('POST', '/api/results', { key, body: { seed, day, answers }, now: at(day) })
}

const row = (id: number) =>
  t.db.prepare('SELECT * FROM children WHERE id = ?').bind(id).first<Record<string, any>>()
const count = async (sql: string, ...args: unknown[]) =>
  (await t.db
    .prepare(sql)
    .bind(...args)
    .first<{ n: number }>())!.n

describe('child routes act for the device child', () => {
  it('shows each device its own child numbers and latest grade', async () => {
    await t.db
      .prepare(
        "UPDATE children SET balance = 40, streak = 3, last_day = '2026-10-16', completed = 5 WHERE id = 1",
      )
      .run()
    await finish(CHILD2_KEY, '2026-10-17', 16)
    const one = await t.call('GET', '/api/state', { key: DEVICE_KEY })
    const two = await t.call('GET', '/api/state', { key: CHILD2_KEY })
    expect(one.body).toMatchObject({ balance: 40, streak: 3, completed: 5, latestGrade: null })
    expect(two.body).toMatchObject({ streak: 1, completed: 1, latestGrade: 'Good' })
    expect(two.body.balance).toBeGreaterThan(0)
  })

  it('records a result from child 2 for child 2 only', async () => {
    const before1 = await row(1)
    const second = await finish(CHILD2_KEY)
    expect(second.status).toBe(201)
    expect(await row(1)).toEqual(before1)
    expect((await row(2))!.completed).toBe(1)
    expect(await count('SELECT COUNT(*) AS n FROM results WHERE child_id = 2')).toBe(1)
  })

  it('records a result from child 1 for child 1 only', async () => {
    const before2 = await row(2)
    const first = await finish(DEVICE_KEY)
    expect(first.status).toBe(201)
    expect(await row(2)).toEqual(before2)
    expect((await row(1))!.completed).toBe(1)
    expect(await count('SELECT COUNT(*) AS n FROM results WHERE child_id = 1')).toBe(1)
    // The same result sent again is the same result, for the same child.
    expect(first.body.state.balance).toBe((await row(1))!.balance)
  })

  it('refuses another device seed', async () => {
    const { body } = await t.call('POST', '/api/seeds', { key: DEVICE_KEY })
    const seed = body.seeds[0] as number
    const answers = generateAssignment(seed).map((p) => p.answer)
    const sent = await t.call('POST', '/api/results', {
      key: CHILD2_KEY,
      body: { seed, day: '2026-10-17', answers },
    })
    expect(sent).toEqual({ status: 404, body: { error: 'unknown_seed' } })
    expect(await count('SELECT COUNT(*) AS n FROM results')).toBe(0)
  })
})

describe('parent reads are scoped to the chosen child', () => {
  beforeEach(async () => {
    await finish(DEVICE_KEY, '2026-10-16')
    await finish(CHILD2_KEY, '2026-10-17')
    await t.db.prepare('UPDATE children SET balance = 41 WHERE id = 1').run()
  })

  it('summary', async () => {
    expect((await parent('GET', '/api/parent/summary', undefined, 1)).body.balance).toBe(41)
    const two = await parent('GET', '/api/parent/summary', undefined, 2)
    expect(two.body).toMatchObject({ lastDay: '2026-10-17', completed: 1 })
    expect(two.body.balance).not.toBe(41)
  })

  it('results and one result', async () => {
    const one = await parent('GET', '/api/parent/results', undefined, 1)
    const two = await parent('GET', '/api/parent/results', undefined, 2)
    expect(one.body.results.map((r: { day: string }) => r.day)).toEqual(['2026-10-16'])
    expect(two.body.results.map((r: { day: string }) => r.day)).toEqual(['2026-10-17'])
    const id1 = one.body.results[0].id
    expect((await parent('GET', `/api/parent/results/${id1}`, undefined, 1)).status).toBe(200)
    expect(await parent('GET', `/api/parent/results/${id1}`, undefined, 2)).toEqual({
      status: 404,
      body: { error: 'unknown_result' },
    })
  })

  it('devices', async () => {
    const labels = async (child: number) =>
      (await parent('GET', '/api/parent/devices', undefined, child)).body.devices.map(
        (d: { label: string }) => d.label,
      )
    expect(await labels(1)).toEqual(['her iPad', 'another iPad'])
    expect(await labels(2)).toEqual(['second iPad'])
  })

  it('log', async () => {
    await parent('POST', '/api/parent/balance', { amount: 5, note: 'One' }, 1)
    await parent('POST', '/api/parent/balance', { amount: 7, note: 'Two' }, 2)
    const notes = async (child: number) =>
      (await parent('GET', '/api/parent/log', undefined, child)).body.entries.map(
        (e: { detail: { note: string } }) => e.detail.note,
      )
    expect(await notes(1)).toEqual(['One'])
    expect(await notes(2)).toEqual(['Two'])
  })
})

describe('parent writes change only the chosen child', () => {
  it('balance and streak', async () => {
    const before1 = await row(1)
    const bal = await parent('POST', '/api/parent/balance', { amount: 12, note: 'Chores' }, 2)
    expect(bal).toEqual({ status: 200, body: { balance: 12 } })
    const streak = await parent('POST', '/api/parent/streak', { streak: 4, lastDay: '2026-10-16' }, 2)
    expect(streak.body).toMatchObject({ balance: 12, streak: 4, lastDay: '2026-10-16' })
    expect(await row(1)).toEqual(before1)
    expect(await count('SELECT COUNT(*) AS n FROM admin_log WHERE child_id = 2')).toBe(2)
    expect(await count('SELECT COUNT(*) AS n FROM admin_log WHERE child_id = 1')).toBe(0)
  })

  it('an overdraw is checked against the chosen child balance', async () => {
    await t.db.prepare('UPDATE children SET balance = 100 WHERE id = 1').run()
    const refused = await parent('POST', '/api/parent/balance', { amount: -5, note: 'x' }, 2)
    expect(refused).toEqual({ status: 409, body: { error: 'overdraw', balance: 0 } })
    expect((await row(1))!.balance).toBe(100)
    expect(await count('SELECT COUNT(*) AS n FROM admin_log')).toBe(0)
  })

  it('a result recorded for the other child does not make an adjustment retry', async () => {
    const res = await parent('POST', '/api/parent/balance', { amount: 3, note: 'x' }, 1)
    expect(res.status).toBe(200)
    await finish(CHILD2_KEY)
    expect((await row(1))!.balance).toBe(3)
  })

  it('unpairing a device of the other child is 404 and leaves it working', async () => {
    const other = await parent('DELETE', '/api/parent/devices/1', undefined, 2)
    expect(other).toEqual({ status: 404, body: { error: 'unknown_device' } })
    expect((await t.call('GET', '/api/state', { key: DEVICE_KEY })).status).toBe(200)
    expect(await count('SELECT COUNT(*) AS n FROM admin_log')).toBe(0)
    const own = await parent('DELETE', '/api/parent/devices/1', undefined, 1)
    expect(own.status).toBe(200)
    expect((await t.call('GET', '/api/state', { key: DEVICE_KEY })).status).toBe(401)
    expect(await count('SELECT COUNT(*) AS n FROM admin_log WHERE child_id = 1')).toBe(1)
  })
})

describe('the child id of a parent route', () => {
  const routes: [string, string, unknown][] = [
    ['GET', '/api/parent/summary', undefined],
    ['GET', '/api/parent/results', undefined],
    ['GET', '/api/parent/results/1', undefined],
    ['GET', '/api/parent/log', undefined],
    ['GET', '/api/parent/devices', undefined],
    ['DELETE', '/api/parent/devices/1', undefined],
    ['POST', '/api/parent/balance', { amount: 5, note: 'x' }],
    ['POST', '/api/parent/streak', { streak: 2, lastDay: '2026-10-16' }],
    ['POST', '/api/parent/pairing-code', { name: 'iPad' }],
  ]

  it.each(routes)(
    '%s %s refuses a missing, bad or unknown child and changes nothing',
    async (method, path, body) => {
      const before = [await row(1), await row(2)]
      for (const bad of ['', 'abc', '0', '-1', '1.5']) {
        const res = await t.call(method, `${path}?child=${bad}`, {
          key: null,
          accessToken: token,
          body,
          child: null,
        })
        expect([bad, res]).toEqual([bad, { status: 400, body: { error: 'bad_child' } }])
      }
      const none = await t.call(method, path, { key: null, accessToken: token, body, child: null })
      expect(none).toEqual({ status: 400, body: { error: 'bad_child' } })
      const unknown = await parent(method, path, body, 99)
      expect(unknown).toEqual({ status: 404, body: { error: 'unknown_child' } })
      expect([await row(1), await row(2)]).toEqual(before)
      expect(await count('SELECT COUNT(*) AS n FROM admin_log')).toBe(0)
      expect(await count('SELECT COUNT(*) AS n FROM pairing_codes')).toBe(0)
      expect((await t.call('GET', '/api/state', { key: DEVICE_KEY })).status).toBe(200)
    },
  )

  it('GET /api/parent/children lists both children in order, and needs a token', async () => {
    const res = await t.call('GET', '/api/parent/children', { key: null, accessToken: token })
    expect(res).toEqual({
      status: 200,
      body: {
        children: [
          { id: 1, name: 'Child', grade: '', initials: 'C' },
          { id: 2, name: 'Second', grade: '', initials: 'S' },
        ],
      },
    })
    expect((await t.call('GET', '/api/parent/children', { key: null })).status).toBe(401)
    expect((await t.call('GET', '/api/parent/children')).status).toBe(401)
  })
})

describe('pairing for a chosen child', () => {
  const makeCode = async (child: number, name = 'iPad') =>
    (await parent('POST', '/api/parent/pairing-code', { name }, child)).body.code as string
  const pair = (code: string, ip?: string) => t.call('POST', '/api/pair', { key: null, body: { code }, ip })

  it('a code made for child 2 pairs a device that acts for child 2', async () => {
    const code = await makeCode(2, 'Her iPad')
    const paired = await pair(code)
    expect(paired.status).toBe(201)
    expect(
      await count('SELECT COUNT(*) AS n FROM devices WHERE label = ? AND child_id = 2', 'Her iPad'),
    ).toBe(1)
    const result = await finish(paired.body.key)
    expect(result.status).toBe(201)
    expect((await row(2))!.completed).toBe(1)
    expect((await row(1))!.completed).toBe(0)
    expect((await parent('GET', '/api/parent/devices', undefined, 2)).body.devices.at(-1).label).toBe(
      'Her iPad',
    )
    expect(await count('SELECT COUNT(*) AS n FROM admin_log WHERE child_id = 2')).toBe(1)
  })

  it('a new code for any child voids the earlier one', async () => {
    const first = await makeCode(2)
    const second = await makeCode(1)
    expect((await pair(first)).status).toBe(400)
    const paired = await pair(second)
    expect(paired.status).toBe(201)
    expect(await count('SELECT child_id AS n FROM devices ORDER BY id DESC LIMIT 1')).toBe(1)
  })

  it('five wrong tries still void a code made for child 2', async () => {
    const code = await makeCode(2)
    const wrong = String((Number(code) + 1) % 1_000_000).padStart(6, '0')
    for (let i = 0; i < 5; i++) expect((await pair(wrong, `192.0.2.${i + 1}`)).status).toBe(400)
    expect((await pair(code, '192.0.2.50')).status).toBe(400)
  })

  it('a code for an unknown child is refused and does not void the earlier code', async () => {
    const code = await makeCode(1)
    const res = await parent('POST', '/api/parent/pairing-code', { name: 'iPad' }, 99)
    expect(res).toEqual({ status: 404, body: { error: 'unknown_child' } })
    expect((await pair(code)).status).toBe(201)
  })
})

describe('preview pairing', () => {
  const CODE = '482915'
  /** A PR preview: marked, with no Access settings. */
  function asPreview() {
    delete t.env.ACCESS_TEAM_DOMAIN
    delete t.env.ACCESS_AUD
    Object.assign(t.env, { PREVIEW: '1', PREVIEW_PAIR_CODE: CODE })
  }

  it('pairs the first child', async () => {
    await asPreview()
    const res = await t.call('POST', '/api/pair', { key: null, body: { code: CODE } })
    expect(res.status).toBe(201)
    expect(await count("SELECT COUNT(*) AS n FROM devices WHERE label = 'Preview' AND child_id = 1")).toBe(1)
    expect(await count("SELECT COUNT(*) AS n FROM devices WHERE label = 'Preview' AND child_id = 2")).toBe(0)
  })

  it('with no children it answers 500, returns no key and adds no device', async () => {
    await asPreview()
    await t.db.prepare('DELETE FROM children').run()
    const res = await t.call('POST', '/api/pair', { key: null, body: { code: CODE } })
    expect(res).toEqual({ status: 500, body: { error: 'server' } })
    expect(await count("SELECT COUNT(*) AS n FROM devices WHERE label = 'Preview'")).toBe(0)
  })
})
