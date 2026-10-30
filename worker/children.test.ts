// Adding and renaming a child (#83): validation, logging, and two-child isolation.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { clearAccessKeys } from './access'
import { accessToken } from './test/access-keys'
import { createTestDb } from './test/db'

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

const parent = (method: string, path: string, body?: unknown, child: number | null = null) =>
  t.call(method, path, { key: null, accessToken: token, body, child })
const add = (body: unknown) => parent('POST', '/api/parent/children', body)
const rename = (id: number | string, body: unknown) => parent('PATCH', `/api/parent/children/${id}`, body)

const row = (id: number) =>
  t.db.prepare('SELECT * FROM children WHERE id = ?').bind(id).first<Record<string, any>>()
const logs = async (childId: number) =>
  (
    await t.db
      .prepare('SELECT email, action, detail, child_id FROM admin_log WHERE child_id = ? ORDER BY id')
      .bind(childId)
      .all<{ email: string; action: string; detail: string; child_id: number }>()
  ).results
const count = async (sql: string) => (await t.db.prepare(sql).first<{ n: number }>())!.n

describe('POST /api/parent/children', () => {
  it('adds a child with a balance of 0 and answers 201', async () => {
    const { status, body } = await add({ name: ' Mary Jane ', grade: '4th grade', initials: 'mj' })
    expect(status).toBe(201)
    expect(body).toEqual({ id: 3, name: 'Mary Jane', grade: '4th grade', initials: 'MJ' })
    expect(await row(3)).toMatchObject({
      name: 'Mary Jane',
      balance: 0,
      streak: 0,
      completed: 0,
      last_day: null,
    })
    expect((await row(3))!.revision).not.toBe('')
  })

  it('fills the initials from the name when they are empty or missing, and the grade stays empty', async () => {
    expect((await add({ name: 'Mary Jane', initials: '' })).body).toMatchObject({ initials: 'MJ', grade: '' })
    expect((await add({ name: 'sam' })).body).toMatchObject({ initials: 'S' })
  })

  it.each([
    ['bad_name', { name: '' }],
    ['bad_name', { name: 'a'.repeat(41) }],
    ['bad_name', { grade: '4th' }],
    ['bad_grade', { name: 'Sam', grade: 'g'.repeat(21) }],
    ['bad_initials', { name: 'Sam', initials: 'ABCD' }],
    ['bad_initials', { name: 'Sam', initials: '12' }],
    ['bad_initials', { name: '123' }],
    ['bad_initials', { name: '123', initials: '  ' }],
  ])('refuses with %s: %j', async (code, input) => {
    const { status, body } = await add(input)
    expect([status, body]).toEqual([400, { error: code }])
    expect(await count('SELECT COUNT(*) AS n FROM children')).toBe(2)
    expect(await count('SELECT COUNT(*) AS n FROM admin_log')).toBe(0)
  })

  it('refuses a body that is not a JSON object with bad_body', async () => {
    for (const body of [undefined, 'text', [1], null]) {
      const { status, body: answer } = await add(body)
      expect([status, answer]).toEqual([400, { error: 'bad_body' }])
    }
  })

  it('allows a name that repeats', async () => {
    expect((await add({ name: 'Second' })).status).toBe(201)
  })

  it('writes one log row for the new child with the email and the fields', async () => {
    await add({ name: 'Mary Jane' })
    expect(await logs(3)).toEqual([
      {
        email: expect.stringContaining('@'),
        action: 'child_add',
        detail: '{"name":"Mary Jane","grade":"","initials":"MJ"}',
        child_id: 3,
      },
    ])
    expect(await count('SELECT COUNT(*) AS n FROM admin_log')).toBe(1)
  })

  it('needs an Access token', async () => {
    const { status } = await t.call('POST', '/api/parent/children', { key: null, body: { name: 'Sam' } })
    expect(status).toBe(401)
    expect(await count('SELECT COUNT(*) AS n FROM children')).toBe(2)
  })
})

describe('PATCH /api/parent/children/:id', () => {
  it('changes only the fields sent', async () => {
    await t.db.prepare("UPDATE children SET grade = '3rd' WHERE id = 2").run()
    const { status, body } = await rename(2, { name: 'Jo' })
    expect([status, body]).toEqual([200, { id: 2, name: 'Jo', grade: '3rd', initials: 'S' }])
    expect(await row(2)).toMatchObject({ name: 'Jo', grade: '3rd', initials: 'S' })
    expect((await row(2))!.revision).not.toBe('second-child-revision')
  })

  it('refills the initials from the new name when initials is empty', async () => {
    const { body } = await rename(1, { name: 'Mary Jane', initials: '' })
    expect(body).toEqual({ id: 1, name: 'Mary Jane', grade: '', initials: 'MJ' })
  })

  it('takes typed initials in capitals, and a grade', async () => {
    const { body } = await rename(1, { grade: ' 5th ', initials: 'xy' })
    expect(body).toEqual({ id: 1, name: 'Child', grade: '5th', initials: 'XY' })
  })

  it.each([
    ['bad_name', { name: ' ' }],
    ['bad_grade', { grade: 'g'.repeat(21) }],
    ['bad_initials', { initials: 'ABCD' }],
    ['bad_initials', { name: '123', initials: '' }],
    ['bad_body', {}],
    ['bad_body', { other: 1 }],
  ])('refuses with %s: %j', async (code, input) => {
    const { status, body } = await rename(1, input)
    expect([status, body]).toEqual([400, { error: code }])
    expect(await row(1)).toMatchObject({ name: 'Child', grade: '', initials: 'C' })
    expect(await logs(1)).toEqual([])
  })

  it('refuses a body that is not JSON with bad_body', async () => {
    expect((await rename(1, undefined)).body).toEqual({ error: 'bad_body' })
  })

  it('is 404 unknown_child for an id with no child', async () => {
    const { status, body } = await rename(9, { name: 'Jo' })
    expect([status, body]).toEqual([404, { error: 'unknown_child' }])
  })

  it('has no route for a non-numeric id or for deleting a child', async () => {
    expect((await rename('abc', { name: 'Jo' })).body).toEqual({ error: 'not_found' })
    const del = await parent('DELETE', '/api/parent/children/2')
    expect([del.status, del.body]).toEqual([404, { error: 'not_found' }])
    expect(await count('SELECT COUNT(*) AS n FROM children')).toBe(2)
  })

  it('keeps balance, streak, last day, completed count and devices', async () => {
    await t.db
      .prepare(
        "UPDATE children SET balance = 40, streak = 3, last_day = '2026-10-16', completed = 5 WHERE id = 1",
      )
      .run()
    await rename(1, { name: 'Mary Jane', initials: '' })
    expect(await row(1)).toMatchObject({ balance: 40, streak: 3, last_day: '2026-10-16', completed: 5 })
    expect(await count('SELECT COUNT(*) AS n FROM devices WHERE child_id = 1')).toBe(2)
  })

  it('logs the old and new fields for the renamed child', async () => {
    await rename(1, { name: 'Mary Jane', initials: '' })
    expect(await logs(1)).toEqual([
      {
        email: expect.stringContaining('@'),
        action: 'child_rename',
        detail:
          '{"before":{"name":"Child","grade":"","initials":"C"},"after":{"name":"Mary Jane","grade":"","initials":"MJ"}}',
        child_id: 1,
      },
    ])
  })

  it('writes no log row when nothing changes', async () => {
    const before = await row(1)
    const { status, body } = await rename(1, { name: ' Child ', grade: '', initials: 'c' })
    expect([status, body]).toEqual([200, { id: 1, name: 'Child', grade: '', initials: 'C' }])
    expect(await row(1)).toEqual(before)
    expect(await logs(1)).toEqual([])
  })

  it('needs an Access token', async () => {
    const { status } = await t.call('PATCH', '/api/parent/children/1', { key: null, body: { name: 'Jo' } })
    expect(status).toBe(401)
    expect((await row(1))!.name).toBe('Child')
  })

  describe('a write racing it', () => {
    /** Runs the next batch only after another writer got in first, `times` times: a lost race. */
    const raceOnBatch = (times: number) => {
      const real = t.env.DB
      let left = times
      t.env.DB = new Proxy(real, {
        get: (target, prop) =>
          prop === 'batch'
            ? async (statements: D1PreparedStatement[]) => {
                if (left-- > 0)
                  await t.db
                    .prepare(
                      'UPDATE children SET balance = balance + 1, revision = lower(hex(randomblob(16))) WHERE id = 1',
                    )
                    .run()
                return target.batch(statements)
              }
            : Reflect.get(target, prop).bind(target),
      })
      return () => (t.env.DB = real)
    }

    it('is retried and applied', async () => {
      const restore = raceOnBatch(1)
      const { status, body } = await rename(1, { name: 'Mary Jane', initials: '' })
      restore()
      expect([status, body]).toMatchObject([200, { name: 'Mary Jane' }])
      expect(await row(1)).toMatchObject({ name: 'Mary Jane', balance: 1 })
      expect(await logs(1)).toHaveLength(1)
    })

    it('is 503 busy after 3 lost races, with nothing changed or logged', async () => {
      const restore = raceOnBatch(3)
      const { status, body } = await rename(1, { name: 'Mary Jane' })
      restore()
      expect([status, body]).toEqual([503, { error: 'busy' }])
      expect(await row(1)).toMatchObject({ name: 'Child', balance: 3 })
      expect(await logs(1)).toEqual([])
    })
  })
})

describe('two children', () => {
  it('lists both in the order they were added', async () => {
    await add({ name: 'Third' })
    const { body } = await parent('GET', '/api/parent/children')
    expect(body.children.map((c: { id: number; name: string }) => [c.id, c.name])).toEqual([
      [1, 'Child'],
      [2, 'Second'],
      [3, 'Third'],
    ])
  })

  it('adding a child leaves child 1 as it was', async () => {
    const before = await row(1)
    const summary = await parent('GET', '/api/parent/summary', undefined, 1)
    await add({ name: 'Third' })
    expect(await row(1)).toEqual(before)
    expect((await parent('GET', '/api/parent/summary', undefined, 1)).body).toEqual(summary.body)
    expect((await parent('GET', '/api/parent/devices', undefined, 1)).body.devices).toHaveLength(2)
    expect((await parent('GET', '/api/parent/log', undefined, 1)).body.entries).toEqual([])
  })

  it("renaming child 2 leaves child 1 as it was, and each child's log shows only its own entries", async () => {
    const before = await row(1)
    await rename(2, { name: 'Jo' })
    expect(await row(1)).toEqual(before)
    const one = await parent('GET', '/api/parent/log', undefined, 1)
    const two = await parent('GET', '/api/parent/log', undefined, 2)
    expect(one.body.entries).toEqual([])
    expect(two.body.entries).toHaveLength(1)
    expect(two.body.entries[0]).toMatchObject({
      action: 'child_rename',
      detail: {
        before: { name: 'Second', initials: 'S' },
        after: { name: 'Jo', initials: 'S' },
      },
    })
    await rename(1, { name: 'Mary Jane' })
    expect((await parent('GET', '/api/parent/log', undefined, 2)).body.entries).toHaveLength(1)
    expect(await row(2)).toMatchObject({ name: 'Jo' })
  })
})
