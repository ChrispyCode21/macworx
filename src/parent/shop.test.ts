import { describe, expect, it } from 'vitest'
import { reachOf } from './shop'

const shorts = (balance: number | null) => reachOf(balance).rewards.map((r) => r.short)
const withins = (balance: number | null) => reachOf(balance).rewards.map((r) => r.within)

describe('reachOf', () => {
  it.each([
    [0, 0],
    [29, 0],
    [30, 1],
    [74, 1],
    [75, 2],
    [299, 2],
    [300, 3],
    [9999, 3],
    [10000, 4],
  ])('at balance %i, %i rewards are within reach', (balance, count) => {
    expect(reachOf(balance).withinCount).toBe(count)
    expect(withins(balance).filter(Boolean)).toHaveLength(count)
  })

  it('says how many Macaronis each reward still needs', () => {
    expect(shorts(0)).toEqual([30, 75, 300, 10000])
    expect(shorts(41)).toEqual([0, 34, 259, 9959])
    expect(shorts(9999)).toEqual([0, 0, 0, 1])
    expect(shorts(10000)).toEqual([0, 0, 0, 0])
  })

  it('keeps the rewards in config order', () => {
    expect(reachOf(0).rewards.map((r) => r.reward.name)).toEqual([
      'Ice Cream',
      'Pet Store',
      'Camping',
      'Puppy',
    ])
  })

  it('reaches nothing and has no count while the balance is unknown', () => {
    expect(reachOf(null).withinCount).toBeNull()
    expect(withins(null)).toEqual([false, false, false, false])
  })
})
