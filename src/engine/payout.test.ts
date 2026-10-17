import { describe, expect, it } from 'vitest'
import { leftEarlyPayout, payout } from './payout'

// SPEC §7.P. "Not first of the day" means no streak bonus applies.
const notFirst = (correct: number) => payout({ correct, problemCount: 20, firstOfDay: false, streak: 3 })

describe('payout (SPEC §6.4)', () => {
  it('P1: 20 correct, not first of the day → 24', () => {
    expect(notFirst(20)).toEqual({ base: 20, accuracyBonus: 4, streakBonus: 0, total: 24 })
  })

  it('P2: 15 correct, not first of the day → 18', () => {
    expect(notFirst(15)).toEqual({ base: 15, accuracyBonus: 3, streakBonus: 0, total: 18 })
  })

  it('P3: 10 correct, not first of the day → 12', () => {
    expect(notFirst(10)).toEqual({ base: 10, accuracyBonus: 2, streakBonus: 0, total: 12 })
  })

  it('P4: 20 correct, first of the day, 7-day streak → 31', () => {
    expect(payout({ correct: 20, problemCount: 20, firstOfDay: true, streak: 7 })).toEqual({
      base: 20,
      accuracyBonus: 4,
      streakBonus: 7,
      total: 31,
    })
  })

  it('P5: 17 correct → accuracy bonus 3.4 rounds down to 3 → 20', () => {
    expect(notFirst(17)).toEqual({ base: 17, accuracyBonus: 3, streakBonus: 0, total: 20 })
  })

  it('P6: 4 correct → accuracy bonus 0.8 rounds down to 0 → 4', () => {
    expect(notFirst(4)).toEqual({ base: 4, accuracyBonus: 0, streakBonus: 0, total: 4 })
  })

  it('P7: 0 correct, not first of the day → raised to the minimum, 1', () => {
    expect(notFirst(0)).toEqual({ base: 0, accuracyBonus: 0, streakBonus: 0, total: 1 })
  })

  it('P8: 0 correct, first of the day, 3-day streak → 3', () => {
    expect(payout({ correct: 0, problemCount: 20, firstOfDay: true, streak: 3 })).toEqual({
      base: 0,
      accuracyBonus: 0,
      streakBonus: 3,
      total: 3,
    })
  })

  it('rejects impossible results instead of paying for them', () => {
    expect(() => notFirst(21)).toThrow(RangeError)
    expect(() => notFirst(-1)).toThrow(RangeError)
    expect(() => notFirst(2.5)).toThrow(RangeError)
    expect(() => payout({ correct: 0, problemCount: 0, firstOfDay: false, streak: 0 })).toThrow(RangeError)
    expect(() => payout({ correct: 5, problemCount: 20, firstOfDay: true, streak: -1 })).toThrow(RangeError)
    const firstOfDay = 'false' as unknown as boolean
    expect(() => payout({ correct: 5, problemCount: 20, firstOfDay, streak: 3 })).toThrow(RangeError)
  })
})

describe('leaving early (SPEC §6.4)', () => {
  // Leaving early pays the base only, whatever the streak or time of day, so there's nothing else to pass.
  it('P9: left after 8 problems, 7 correct → base only, 7', () => {
    expect(leftEarlyPayout(7)).toEqual({ base: 7, accuracyBonus: 0, streakBonus: 0, total: 7 })
  })

  it('P10: left after 3 problems, 0 correct → 0, no minimum', () => {
    expect(leftEarlyPayout(0)).toEqual({ base: 0, accuracyBonus: 0, streakBonus: 0, total: 0 })
  })

  it('rejects impossible counts', () => {
    for (const correct of [-1, 2.5, Number.NaN]) expect(() => leftEarlyPayout(correct)).toThrow(RangeError)
  })
})
