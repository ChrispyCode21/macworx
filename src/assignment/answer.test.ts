import { describe, expect, it } from 'vitest'
import { deleteDigit, MAX_DIGITS, typeDigit } from './answer'

describe('number pad typing', () => {
  it('appends digits', () => {
    expect(typeDigit(typeDigit('', 5), 6)).toBe('56')
  })

  it('allows a lone 0, since subtraction can give 0', () => {
    expect(typeDigit('', 0)).toBe('0')
  })

  it('replaces a leading 0 instead of keeping it', () => {
    expect(typeDigit('0', 7)).toBe('7')
    expect(typeDigit('0', 0)).toBe('0')
  })

  it(`stops at ${MAX_DIGITS} digits, enough for 199,998`, () => {
    expect(typeDigit('199998', 1)).toBe('199998')
  })

  it('deletes the last digit, and does nothing when empty', () => {
    expect(deleteDigit('56')).toBe('5')
    expect(deleteDigit('')).toBe('')
  })
})
