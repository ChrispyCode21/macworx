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
const passage = {
  id: 1,
  title: 'A Story',
  genre: '',
  minutes: 2,
  hint: '',
  paragraphs: ['One.'],
  image: null,
  questions: [{ id: 7, text: 'Q?', choices: [{ id: 70, text: 'a' }] }],
}
const resultBody = {
  result: {
    attempt: 5,
    day: '2026-11-09',
    answered: 1,
    correct: 1,
    questions: [{ id: 7, right: true, rightChoice: 70, explanation: '' }],
    payout: { base: 10, accuracyBonus: 0, streakBonus: 5, total: 15 },
  },
  state: { balance: 99, streak: 7, lastDay: '2026-11-09', completed: 3, latestGrade: 'Excellent' },
}
const mathState = { balance: 20, streak: 6, lastDay: '2026-11-08', completed: 2, latestGrade: 'Good' }

type Handler = () => Response | 'offline'
let calls: string[]
let routes: Record<string, Handler>
let reading: typeof import('./reading')

beforeEach(async () => {
  globalThis.localStorage = fakeStorage()
  setDeviceKey('key')
  calls = []
  routes = {
    'POST /api/results': () => json(201, { result: {}, state: mathState }),
    'POST /api/seeds': () => json(200, { seeds: [] }),
    'GET /api/state': () => json(200, mathState),
    'POST /api/reading/start': () => json(200, { attempt: 5, passage }),
    'POST /api/reading/result': () => json(201, resultBody),
  }
  vi.stubGlobal('fetch', async (path: string, init: RequestInit) => {
    calls.push(`${init.method} ${path}`)
    const answer = routes[`${init.method} ${path}`]()
    if (answer === 'offline') throw new TypeError('Load failed')
    return answer
  })
  vi.resetModules()
  reading = await import('./reading')
})

describe('starting a reading assignment', () => {
  it('L17: the unsent math result goes first, so the streak is 6 before the reading result makes it 7', async () => {
    queueResult({ seed: 1, day: '2026-11-08', answers: [1, 2, 3] })
    const started = await reading.startReading()
    expect(started.kind).toBe('passage')
    expect(calls.indexOf('POST /api/results')).toBeGreaterThanOrEqual(0)
    expect(calls.indexOf('POST /api/results')).toBeLessThan(calls.indexOf('POST /api/reading/start'))
    // The sent math result moved the streak to 6 ...
    expect(getWorkerState()?.streak).toBe(6)
    // ... and the reading result, the first of the day, takes it to 7.
    const checked = await reading.checkReading(5, [{ question: 7, choice: 70 }], new Date(2026, 10, 9))
    expect(checked.kind).toBe('checked')
    expect(getWorkerState()?.streak).toBe(7)
    expect(getWorkerState()?.balance).toBe(99)
  })

  it('starts nothing while a math result can not be sent', async () => {
    queueResult({ seed: 1, day: '2026-11-08', answers: [1, 2, 3] })
    routes['POST /api/results'] = () => 'offline'
    expect((await reading.startReading()).kind).toBe('offline')
    expect(calls).not.toContain('POST /api/reading/start')
  })

  it('is offline when the start call fails or answers badly', async () => {
    routes['POST /api/reading/start'] = () => 'offline'
    expect((await reading.startReading()).kind).toBe('offline')
    routes['POST /api/reading/start'] = () => json(503, { error: 'busy' })
    expect((await reading.startReading()).kind).toBe('offline')
  })

  it('opens the sample for an iPad that is not paired, without any call', async () => {
    localStorage.clear()
    expect((await reading.startReading()).kind).toBe('sample')
    expect(calls).toEqual([])
  })

  it('opens the sample when the Worker has no passages', async () => {
    routes['POST /api/reading/start'] = () => json(200, { passage: null })
    expect((await reading.startReading()).kind).toBe('sample')
  })

  it('forgets the key on a 401 and opens the sample', async () => {
    routes['POST /api/reading/start'] = () => json(401, { error: 'unauthorized' })
    expect((await reading.startReading()).kind).toBe('sample')
    expect(getDeviceKey()).toBeNull()
  })
})

describe('checking answers', () => {
  const picks = [{ question: 7, choice: 70 }]
  const now = new Date(2026, 10, 9, 15)

  it('sends the attempt, her own day and her choice ids', async () => {
    let body: unknown
    vi.stubGlobal('fetch', async (_path: string, init: RequestInit) => {
      body = JSON.parse(init.body as string)
      return json(201, resultBody)
    })
    await reading.checkReading(5, picks, now)
    expect(body).toEqual({ attempt: 5, day: '2026-11-09', picks })
  })

  it('offline keeps nothing stored, and a retry reuses the attempt without calling start', async () => {
    routes['POST /api/reading/result'] = () => 'offline'
    expect((await reading.checkReading(5, picks, now)).kind).toBe('offline')
    expect(getWorkerState()).toBeNull()
    routes['POST /api/reading/result'] = () => json(200, resultBody)
    const again = await reading.checkReading(5, picks, now)
    expect(again.kind).toBe('checked')
    expect(calls.filter((c) => c === 'POST /api/reading/result')).toHaveLength(2)
    expect(calls).not.toContain('POST /api/reading/start')
  })

  it('a repeated 200 carries the same recorded numbers', async () => {
    routes['POST /api/reading/result'] = () => json(200, resultBody)
    const first = await reading.checkReading(5, picks, now)
    const second = await reading.checkReading(5, picks, now)
    expect(second).toEqual(first)
    expect(getWorkerState()?.balance).toBe(99)
  })
})

describe('pairing questions', () => {
  it('pairs ten into five, and leaves an odd last one alone', () => {
    expect(reading.pairQuestions(10)).toHaveLength(5)
    expect(reading.pairQuestions(5)).toEqual([[0, 1], [2, 3], [4]])
    expect(reading.pairQuestions(1)).toEqual([[0]])
  })

  it('counts the questions still to answer', () => {
    expect(reading.leftToAnswer(10, 7)).toBe(3)
    expect(reading.leftToAnswer(10, 10)).toBe(0)
  })
})
