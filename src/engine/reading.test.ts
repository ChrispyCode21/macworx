import { describe, expect, it } from 'vitest'
import { scoreReading } from './reading'

describe('scoreReading (SPEC §6.3)', () => {
  it('counts the picks that match the right choice, index 0 included', () => {
    expect(scoreReading([0, 2, 1, 3], [0, 2, 0, 0])).toBe(2)
  })

  it('counts none and all', () => {
    expect(scoreReading([1, 2, 3], [0, 0, 0])).toBe(0)
    expect(scoreReading([1, 2, 3], [1, 2, 3])).toBe(3)
  })

  it('does not count a pick that is not a whole number', () => {
    expect(scoreReading([1], [1.5])).toBe(0)
  })

  it('rejects empty passages and mismatched lengths', () => {
    expect(() => scoreReading([], [])).toThrow(RangeError)
    expect(() => scoreReading([1, 2], [1])).toThrow(RangeError)
    expect(() => scoreReading([1], [1, 2])).toThrow(RangeError)
  })
})
