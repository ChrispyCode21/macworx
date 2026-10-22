import { afterEach, describe, expect, it } from 'vitest'
import {
  canPair,
  dropQueued,
  forgetDeviceKey,
  getDeviceKey,
  getQueue,
  getSeeds,
  getWorkerState,
  queueResult,
  setDeviceKey,
  setSeeds,
  setWorkerState,
} from './device'

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

afterEach(() => {
  delete (globalThis as { localStorage?: Storage }).localStorage
})

describe('device key storage', () => {
  it('keeps the key, and forgets it', () => {
    globalThis.localStorage = fakeStorage()
    expect(getDeviceKey()).toBeNull()
    setDeviceKey('abc')
    expect(getDeviceKey()).toBe('abc')
    forgetDeviceKey()
    expect(getDeviceKey()).toBeNull()
  })

  it('reports a key it could not keep', () => {
    expect(setDeviceKey('abc')).toBe(false) // no storage at all
    globalThis.localStorage = {
      ...fakeStorage(),
      setItem: () => {
        throw new Error('quota')
      },
    }
    expect(setDeviceKey('abc')).toBe(false)
    globalThis.localStorage = fakeStorage()
    expect(setDeviceKey('abc')).toBe(true)
  })

  it('reads as not paired when storage is missing or refuses', () => {
    expect(getDeviceKey()).toBeNull()
    expect(() => forgetDeviceKey()).not.toThrow()
    globalThis.localStorage = {
      ...fakeStorage(),
      getItem: () => {
        throw new Error('denied')
      },
    }
    expect(getDeviceKey()).toBeNull()
  })
})

describe('seeds, queue and state', () => {
  const state = { balance: 25, streak: 1, lastDay: '2026-10-17', completed: 1, latestGrade: 'Excellent' }

  it('keeps each, and forgetting the key forgets them all', () => {
    globalThis.localStorage = fakeStorage()
    setDeviceKey('abc')
    setSeeds([3, 1, 2])
    queueResult({ seed: 7, day: '2026-10-17', answers: [1, 2] })
    queueResult({ seed: 8, day: '2026-10-17', answers: [3] })
    setWorkerState(state)
    expect(getSeeds()).toEqual([3, 1, 2])
    expect(getWorkerState()).toEqual(state)
    dropQueued(7)
    expect(getQueue()).toEqual([{ seed: 8, day: '2026-10-17', answers: [3] }])
    forgetDeviceKey()
    expect([getDeviceKey(), getSeeds(), getQueue(), getWorkerState()]).toEqual([null, [], [], null])
  })

  it('reads anything it cannot make sense of as empty', () => {
    globalThis.localStorage = fakeStorage()
    localStorage.setItem('macworx.seeds', '{not json')
    localStorage.setItem('macworx.state', '7')
    expect([getSeeds(), getWorkerState()]).toEqual([[], null])
  })

  it('keeps the queued results it can read when one it cannot is among them', () => {
    globalThis.localStorage = fakeStorage()
    const good = { seed: 7, day: '2026-10-17', answers: [1] }
    localStorage.setItem('macworx.queue', JSON.stringify([{ seed: 'x' }, good]))
    expect(getQueue()).toEqual([good])
  })

  it('works without storage at all', () => {
    expect(() => setSeeds([1])).not.toThrow()
    expect(getSeeds()).toEqual([])
  })
})

describe('Pair button (SPEC §5.4)', () => {
  it('A12: a preview build, not installed → Pair shows; a production build, not installed → it does not', () => {
    expect(canPair(true)).toBe(true)
    expect(canPair(false)).toBe(false)
  })
})
