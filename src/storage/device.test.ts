import { afterEach, describe, expect, it } from 'vitest'
import { forgetDeviceKey, getDeviceKey, setDeviceKey } from './device'

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
