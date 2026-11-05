import { describe, expect, it } from 'vitest'
import { checkChoice } from './choice'

describe('checkChoice', () => {
  it('is true when the chosen index is the answer', () => {
    expect(checkChoice(2, 2)).toBe(true)
  })
  it('is false for any other choice', () => {
    expect(checkChoice(1, 2)).toBe(false)
  })
  it('treats index 0 as a real answer, not a falsy one', () => {
    expect(checkChoice(0, 0)).toBe(true)
    expect(checkChoice(0, 1)).toBe(false)
  })
  it('is false for a non-integer index', () => {
    expect(checkChoice(1.5, 1.5)).toBe(false)
    expect(checkChoice(NaN, NaN)).toBe(false)
  })
})
