import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Child } from './api'
import { pickChild, readSelectedChild, rememberChild } from './selection'

const child = (id: number): Child => ({ id, name: `Child ${id}`, grade: '', initials: 'C' })

afterEach(() => vi.unstubAllGlobals())

describe('pickChild', () => {
  const list = [child(1), child(2)]
  it('picks the remembered child when she is in the list', () => {
    expect(pickChild(list, 2)?.id).toBe(2)
  })
  it('falls back to the first child', () => {
    expect(pickChild(list, 9)?.id).toBe(1)
    expect(pickChild(list, null)?.id).toBe(1)
  })
  it('picks nobody from an empty list', () => {
    expect(pickChild([], 1)).toBeNull()
  })
})

describe('the remembered child', () => {
  it('round trips through storage', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    })
    expect(readSelectedChild()).toBeNull()
    rememberChild(2)
    expect(readSelectedChild()).toBe(2)
    store.set('macworx.parentChild', 'junk')
    expect(readSelectedChild()).toBeNull()
  })

  it('survives storage that refuses', () => {
    const refuse = () => {
      throw new Error('blocked')
    }
    vi.stubGlobal('localStorage', { getItem: refuse, setItem: refuse })
    expect(readSelectedChild()).toBeNull()
    expect(() => rememberChild(2)).not.toThrow()
  })
})
