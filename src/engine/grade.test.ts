import { describe, expect, it } from 'vitest'
import { grade } from './grade'

describe('grade (SPEC §6.6)', () => {
  it('G1: 20 of 20 (100%) → Excellent', () => expect(grade(20, 20)).toBe('Excellent'))
  it('G2: 19 of 20 (95%) → Great', () => expect(grade(19, 20)).toBe('Great'))
  it('G3: 18 of 20 (90%) → Great', () => expect(grade(18, 20)).toBe('Great'))
  it('G4: 17 of 20 (85%) → Good', () => expect(grade(17, 20)).toBe('Good'))
  it('G5: 16 of 20 (80%) → Good', () => expect(grade(16, 20)).toBe('Good'))
  it('G6: 15 of 20 (75%) → Improving', () => expect(grade(15, 20)).toBe('Improving'))
  it('G7: 0 of 20 (0%) → Improving', () => expect(grade(0, 20)).toBe('Improving'))

  it('uses exact cutoffs for other problem counts', () => {
    expect(grade(9, 10)).toBe('Great')
    expect(grade(8, 9)).toBe('Good') // 88.9%
    expect(grade(4, 5)).toBe('Good')
  })

  it('rejects impossible results', () => {
    expect(() => grade(21, 20)).toThrow(RangeError)
    expect(() => grade(-1, 20)).toThrow(RangeError)
    expect(() => grade(0, 0)).toThrow(RangeError)
  })
})
