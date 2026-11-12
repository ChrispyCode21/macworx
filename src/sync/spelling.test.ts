import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getDeviceKey, getWorkerState, queueResult, setDeviceKey } from '../storage/device'

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

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })
const words = [
  { id: 4, word: 'friend', sentence: 'My friend came.', alternates: [] },
  { id: 9, word: 'colour', sentence: '', alternates: ['color'] },
]
const resultBody = {
  result: {
    attempt: 5,
    day: '2026-11-09',
    answered: 2,
    correct: 1,
    finished: true,
    grade: 'Good',
    payout: { base: 1, accuracyBonus: 0, streakBonus: 5, total: 6 },
    words: [],
  },
  state: { balance: 99, streak: 7, lastDay: '2026-11-09', completed: 3, latestGrade: 'Good' },
}
const mathState = { balance: 20, streak: 6, lastDay: '2026-11-08', completed: 2, latestGrade: 'Good' }

type Handler = () => Response | 'offline'
let calls: string[]
let bodies: Record<string, unknown>
let routes: Record<string, Handler>
let spelling: typeof import('./spelling')

beforeEach(async () => {
  globalThis.localStorage = fakeStorage()
  setDeviceKey('key')
  calls = []
  bodies = {}
  routes = {
    'POST /api/results': () => json(201, { result: {}, state: mathState }),
    'POST /api/seeds': () => json(200, { seeds: [] }),
    'GET /api/state': () => json(200, mathState),
    'POST /api/spelling/start': () => json(200, { attempt: 5, words }),
    'POST /api/spelling/result': () => json(201, resultBody),
  }
  vi.stubGlobal('fetch', async (path: string, init: RequestInit) => {
    calls.push(`${init.method} ${path}`)
    if (init.body) bodies[path] = JSON.parse(String(init.body))
    const answer = routes[`${init.method} ${path}`]()
    if (answer === 'offline') throw new TypeError('Load failed')
    return answer
  })
  vi.resetModules()
  spelling = await import('./spelling')
})

describe('starting a spelling assignment', () => {
  it('gives the Worker’s words and attempt, after sending unsent math results', async () => {
    queueResult({ seed: 1, day: '2026-11-08', answers: [1, 2, 3] })
    expect(await spelling.startSpelling()).toEqual({ kind: 'words', attempt: 5, words })
    expect(calls.indexOf('POST /api/results')).toBeLessThan(calls.indexOf('POST /api/spelling/start'))
  })

  it('opens the sample on an unpaired iPad without asking the Worker', async () => {
    localStorage.clear()
    expect(await spelling.startSpelling()).toEqual({ kind: 'sample' })
    expect(calls).toEqual([])
  })

  it('opens the sample when the Worker has no words', async () => {
    routes['POST /api/spelling/start'] = () => json(200, { words: null })
    expect(await spelling.startSpelling()).toEqual({ kind: 'sample' })
  })

  it('opens the sample, and forgets the key, when a parent unpaired the iPad', async () => {
    routes['POST /api/spelling/start'] = () => json(401, {})
    expect(await spelling.startSpelling()).toEqual({ kind: 'sample' })
    expect(getDeviceKey()).toBeNull()
  })

  it.each([
    ['no connection', () => 'offline' as const],
    ['a busy Worker', () => json(503, {})],
    ['a body with no words', () => json(200, { attempt: 5 })],
    ['a word with no sentence', () => json(200, { attempt: 5, words: [{ id: 1, word: 'a' }] })],
    ['an empty list', () => json(200, { attempt: 5, words: [] })],
  ])('shows the Wi-Fi line for %s', async (_name, handler) => {
    routes['POST /api/spelling/start'] = handler
    expect(await spelling.startSpelling()).toEqual({ kind: 'offline' })
  })

  it('shows the Wi-Fi line when unsent results can’t be sent first', async () => {
    queueResult({ seed: 1, day: '2026-11-08', answers: [1, 2, 3] })
    routes['POST /api/results'] = () => 'offline'
    expect(await spelling.startSpelling()).toEqual({ kind: 'offline' })
    expect(calls).not.toContain('POST /api/spelling/start')
  })
})

describe('finishing a spelling assignment', () => {
  const typed = [
    { word: 4, typed: 'frend' },
    { word: 9, typed: 'color' },
  ]

  it('sends her typing with the attempt and her day, then keeps the Worker’s new numbers', async () => {
    const outcome = await spelling.finishSpelling(5, typed, new Date(2026, 10, 9, 12))
    expect(outcome).toEqual({ kind: 'checked', result: resultBody.result })
    expect(bodies['/api/spelling/result']).toEqual({ attempt: 5, day: '2026-11-09', answers: typed })
    expect(getWorkerState()).toMatchObject({ balance: 99, streak: 7 })
  })

  it('sends unsent math results first, so the streak is counted in order', async () => {
    queueResult({ seed: 1, day: '2026-11-08', answers: [1, 2, 3] })
    await spelling.finishSpelling(5, typed, new Date())
    expect(calls.indexOf('POST /api/results')).toBeLessThan(calls.indexOf('POST /api/spelling/result'))
  })

  it('is voided on a 404: nothing recorded, and the state is left alone', async () => {
    routes['POST /api/spelling/result'] = () => json(404, {})
    expect(await spelling.finishSpelling(5, typed, new Date())).toEqual({ kind: 'voided' })
    expect(getWorkerState()).toMatchObject({ balance: 20 })
  })

  it.each([
    ['no connection', () => 'offline' as const],
    ['a busy Worker', () => json(503, {})],
    ['a bad body', () => json(201, { result: { correct: 'x' } })],
    ['a rejected answer', () => json(400, {})],
  ])('is offline for %s, so she can tap Finish again', async (_name, handler) => {
    routes['POST /api/spelling/result'] = handler
    expect(await spelling.finishSpelling(5, typed, new Date())).toEqual({ kind: 'offline' })
  })

  it('is offline, and forgets the key, when a parent unpaired the iPad', async () => {
    routes['POST /api/spelling/result'] = () => json(401, {})
    expect(await spelling.finishSpelling(5, typed, new Date())).toEqual({ kind: 'offline' })
    expect(getDeviceKey()).toBeNull()
  })

  it('a retry sends the same attempt and never asks for words again', async () => {
    let first = true
    routes['POST /api/spelling/result'] = () => {
      if (!first) return json(201, resultBody)
      first = false
      return 'offline'
    }
    expect((await spelling.finishSpelling(5, typed, new Date())).kind).toBe('offline')
    expect((await spelling.finishSpelling(5, typed, new Date())).kind).toBe('checked')
    expect(calls.filter((c) => c === 'POST /api/spelling/start')).toEqual([])
    expect(calls.filter((c) => c === 'POST /api/spelling/result')).toHaveLength(2)
  })
})
