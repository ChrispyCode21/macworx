import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getDeviceKey,
  getQueue,
  getSeeds,
  getWorkerState,
  queueResult,
  setDeviceKey,
  setSeeds,
} from '../storage/device'

function fakeStorage(): Storage {
  const items = new Map<string, string>()
  return {
    getItem: (k) => items.get(k) ?? null,
    setItem: (k, v) => void items.set(k, v),
    removeItem: (k) => void items.delete(k),
    clear: () => items.clear(),
    key: () => null,
    get length() {
      return items.size
    },
  }
}

const state = { balance: 25, streak: 1, lastDay: '2026-10-17', completed: 1, latestGrade: 'Excellent' }
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })
const result = (seed: number) => ({ seed, day: '2026-10-17', answers: [1, 2, 3] })

type Handler = (body: { seed?: number } | undefined) => Response | Promise<Response> | 'offline'
let calls: string[]
let routes: Record<string, Handler>

/** A Worker that answers results with 201, seeds with `seeds`, and state with `state`, unless a route is replaced. */
function worker(seeds: number[] = [], overrides: Record<string, Handler> = {}) {
  routes = {
    'POST /api/results': () => json(201, { result: {}, state }),
    'POST /api/seeds': () => json(200, { seeds }),
    'GET /api/state': () => json(200, { ...state, applied: [] }),
    ...overrides,
  }
}

let sync: typeof import('./sync')

beforeEach(async () => {
  globalThis.localStorage = fakeStorage()
  setDeviceKey('key')
  calls = []
  worker()
  vi.stubGlobal('fetch', async (path: string, init: RequestInit) => {
    const body = init.body ? JSON.parse(init.body as string) : undefined
    calls.push(`${init.method} ${path}${body?.seed === undefined ? '' : ` ${body.seed}`}`)
    const answer = await routes[`${init.method} ${path}`](body)
    if (answer === 'offline') throw new TypeError('Load failed')
    return answer
  })
  vi.resetModules()
  sync = await import('./sync')
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete (globalThis as { localStorage?: Storage }).localStorage
})

describe('sync', () => {
  it('does nothing without a device key', async () => {
    localStorage.clear()
    expect(await sync.sync()).toBe('done')
    expect(calls).toEqual([])
  })

  it('sends results oldest first, then tops up seeds and state', async () => {
    queueResult(result(1))
    queueResult(result(2))
    worker([5, 6])
    expect(await sync.sync()).toBe('done')
    expect(calls).toEqual(['POST /api/results 1', 'POST /api/results 2', 'POST /api/seeds', 'GET /api/state'])
    expect(getQueue()).toEqual([])
    expect(getSeeds()).toEqual([5, 6])
    expect(getWorkerState()).toEqual(state)
  })

  it('stops at the first result it cannot send, keeping it and the rest', async () => {
    queueResult(result(1))
    queueResult(result(2))
    queueResult(result(3))
    worker([], { 'POST /api/results': (b) => (b?.seed === 2 ? 'offline' : json(201, { result: {}, state })) })
    expect(await sync.sync()).toBe('offline')
    expect(getQueue().map((r) => r.seed)).toEqual([2, 3])
    expect(calls).not.toContain('POST /api/seeds')
  })

  it.each([429, 500, 503])('holds the queue on %i, and still tops up seeds', async (status) => {
    queueResult(result(1))
    queueResult(result(2))
    setSeeds([9])
    worker([5, 9], { 'POST /api/results': () => json(status, { error: 'busy' }) })
    expect(await sync.sync()).toBe('offline')
    expect(getQueue().map((r) => r.seed)).toEqual([1, 2])
    expect(calls.filter((c) => c.startsWith('POST /api/results'))).toHaveLength(1)
    expect(getSeeds()).toEqual([9, 5])
  })

  it('holds a result answered by anything but the Worker (a 404 page, a 200 without a result)', async () => {
    queueResult(result(1))
    worker([], { 'POST /api/results': () => json(404, { error: 'not_found' }) })
    await sync.sync()
    worker([], { 'POST /api/results': () => json(200, {}) })
    await sync.sync()
    expect(getQueue()).toHaveLength(1)
  })

  it('runs again after a run that ended offline, when asked meanwhile', async () => {
    queueResult(result(1))
    let online = false
    worker([], { 'POST /api/results': () => (online ? json(201, { result: {}, state }) : 'offline') })
    const first = sync.sync()
    online = true
    void sync.sync()
    expect(await first).toBe('done')
    expect(getQueue()).toEqual([])
  })

  it('counts a result the Worker already has (200) as sent', async () => {
    queueResult(result(1))
    worker([], { 'POST /api/results': () => json(200, { result: {}, state }) })
    await sync.sync()
    expect(getQueue()).toEqual([])
  })

  it.each([
    [400, 'bad_result'],
    [404, 'unknown_seed'],
  ])('drops a result refused with %i %s and carries on', async (status, code) => {
    queueResult(result(1))
    queueResult(result(2))
    worker([], {
      'POST /api/results': (b) =>
        b?.seed === 1 ? json(status, { error: code }) : json(201, { result: {}, state }),
    })
    expect(await sync.sync()).toBe('done')
    expect(calls.slice(0, 2)).toEqual(['POST /api/results 1', 'POST /api/results 2'])
    expect(getQueue()).toEqual([])
  })

  it('forgets the key and everything stored for it on a 401', async () => {
    queueResult(result(1))
    setSeeds([9])
    worker([], { 'POST /api/results': () => json(401, {}) })
    expect(await sync.sync()).toBe('unpaired')
    expect([getDeviceKey(), getQueue(), getSeeds()]).toEqual([null, [], []])
  })

  it('keeps stored seeds in order, adds new ones, and leaves out the in-progress seed', async () => {
    setSeeds([4, 2, 3, 8])
    expect(sync.takeSeed()).toBe(4)
    // The Worker still counts 4 (in progress) unused; 8 it no longer lists.
    worker([1, 2, 3, 4, 7])
    await sync.sync()
    expect(getSeeds()).toEqual([2, 3, 1, 7])
  })

  it('leaves out seeds queued or started while the seeds request was out', async () => {
    setSeeds([1, 2])
    let reply!: () => void
    // The Worker still counts 1 unused until the queued result reaches it.
    let first = true
    worker([], {
      'POST /api/results': () => json(201, { result: {}, state }),
      'POST /api/seeds': () => {
        if (!first) return json(200, { seeds: [2, 3] })
        first = false
        return new Promise((resolve) => (reply = () => resolve(json(200, { seeds: [1, 2, 3] }))))
      },
    })
    const running = sync.sync()
    await vi.waitFor(() => expect(calls).toContain('POST /api/seeds'))
    expect(sync.takeSeed()).toBe(1)
    sync.endSeed(1, [5], new Date(2026, 9, 17))
    expect(sync.takeSeed()).toBe(2)
    reply()
    // Checked between the first run's top-up and the rerun that sends seed 1.
    await vi.waitFor(() => expect(calls).toContain('POST /api/results 1'))
    expect(getSeeds()).toEqual([3])
    await running
    expect(getSeeds()).toEqual([3])
  })

  it('shares one run between calls, and runs once more for anything queued meanwhile', async () => {
    queueResult(result(1))
    const first = sync.sync()
    const second = sync.sync()
    expect(second).toBe(first)
    queueResult(result(2))
    await first
    expect(calls.filter((c) => c.startsWith('POST /api/results'))).toEqual([
      'POST /api/results 1',
      'POST /api/results 2',
    ])
    expect(calls.filter((c) => c === 'POST /api/seeds')).toHaveLength(2)
  })
})

describe('taking and ending seeds', () => {
  it('queues her answers with the iPad day, and sends them', async () => {
    setSeeds([1, 2])
    expect(sync.takeSeed()).toBe(1)
    sync.endSeed(1, [5, 6], new Date(2026, 9, 17, 23, 30))
    expect(getQueue()).toEqual([{ seed: 1, day: '2026-10-17', answers: [5, 6] }])
    await vi.waitFor(() => expect(getQueue()).toEqual([]))
    expect(calls[0]).toBe('POST /api/results 1')
  })

  it('puts a seed left with no answers at the back', () => {
    setSeeds([1, 2, 3])
    sync.takeSeed()
    sync.endSeed(1, [], new Date())
    expect(getSeeds()).toEqual([2, 3, 1])
    expect(getQueue()).toEqual([])
  })

  it('keeps nothing when the iPad was unpaired during the assignment', () => {
    setSeeds([1, 2])
    sync.takeSeed()
    localStorage.clear()
    setDeviceKey('new key')
    sync.endSeed(1, [5], new Date())
    expect([getQueue(), getSeeds()]).toEqual([[], []])
  })

  it('ignores a seed it did not hand out, and has none to give without a key', () => {
    setSeeds([1])
    sync.endSeed(42, [5], new Date())
    expect(getQueue()).toEqual([])
    localStorage.clear()
    expect(sync.takeSeed()).toBeNull()
  })

  it('dates with the iPad’s own calendar day', () => {
    expect(sync.localDay(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05')
  })
})
