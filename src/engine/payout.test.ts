import { describe, expect, it } from 'vitest'
import { grade } from './grade'
import { leftEarlyPayout, payout } from './payout'
import { addDays, nextStreak } from './streak'

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

describe('reading payout (SPEC §6.4, §7.L)', () => {
  const reading = (correct: number, problemCount: number, firstOfDay = false, streak = 0) =>
    payout({ correct, problemCount, firstOfDay, streak })

  it('L1: 4 of 4, first of the day, streak 1 → 25, Excellent', () => {
    expect(reading(4, 4, true, 1)).toEqual({ base: 20, accuracyBonus: 4, streakBonus: 1, total: 25 })
    expect(grade(4, 4)).toBe('Excellent')
  })

  it('L2: 3 of 4, not first of the day → 18, Improving', () => {
    expect(reading(3, 4)).toEqual({ base: 15, accuracyBonus: 3, streakBonus: 0, total: 18 })
    expect(grade(3, 4)).toBe('Improving')
  })

  it('L3: 2 of 3 → base 13.3 rounds down to 13, bonus 2 → 15, Improving', () => {
    expect(reading(2, 3)).toEqual({ base: 13, accuracyBonus: 2, streakBonus: 0, total: 15 })
    expect(grade(2, 3)).toBe('Improving')
  })

  it('L4: 0 of 3 → raised to the minimum, 1', () => {
    expect(reading(0, 3)).toEqual({ base: 0, accuracyBonus: 0, streakBonus: 0, total: 1 })
  })

  it('L5: 4 of 5 → base 16, bonus 3 → 19, Good', () => {
    expect(reading(4, 5)).toEqual({ base: 16, accuracyBonus: 3, streakBonus: 0, total: 19 })
    expect(grade(4, 5)).toBe('Good')
  })

  it('L10: reading after math earlier today, 3 of 3 → 24, streak stays 3', () => {
    const today = '2026-10-17'
    const after = nextStreak({ streak: 3, lastDay: today }, today)
    expect(after).toMatchObject({ streak: 3, firstOfDay: false })
    expect(reading(3, 3, after.firstOfDay, after.streak).total).toBe(24)
  })

  it('L11: a reading 2 of 3 grades Improving (payout arithmetic and grade only)', () => {
    expect(grade(2, 3)).toBe('Improving')
  })

  it('L16: moved day pays no streak bonus, 3 of 3 → 24 (payout arithmetic only)', () => {
    expect(reading(3, 3, false, 5)).toEqual({ base: 20, accuracyBonus: 4, streakBonus: 0, total: 24 })
  })

  it('L17: streak 5 then math from yesterday then reading → 6, then 7 (payout arithmetic only)', () => {
    const today = '2026-10-17'
    const yesterday = addDays(today, -1)
    const afterMath = nextStreak({ streak: 5, lastDay: addDays(today, -2) }, yesterday)
    expect(afterMath.streak).toBe(6)
    const afterReading = nextStreak(afterMath, today)
    expect(afterReading).toMatchObject({ streak: 7, firstOfDay: true })
    expect(reading(3, 3, afterReading.firstOfDay, afterReading.streak)).toEqual({
      base: 20,
      accuracyBonus: 4,
      streakBonus: 7,
      total: 31,
    })
  })

  it('pays the same base for a perfect result of any size', () => {
    for (const size of [3, 5, 10, 20]) expect(reading(size, size).base, `size ${size}`).toBe(20)
  })

  it('rejects a size of 0', () => {
    expect(() => reading(0, 0)).toThrow(RangeError)
  })
})

describe('leaving early (SPEC §6.4)', () => {
  // Leaving early pays the base only, whatever the streak or time of day, so there's nothing else to pass.
  it('P9: left after 8 problems, 7 correct → base only, 7', () => {
    expect(leftEarlyPayout({ correct: 7, answered: 8, problemCount: 20 })).toEqual({
      base: 7,
      accuracyBonus: 0,
      streakBonus: 0,
      total: 7,
    })
  })

  it('P10: left after 3 problems, 0 correct → 0, no minimum', () => {
    expect(leftEarlyPayout({ correct: 0, answered: 3, problemCount: 20 })).toEqual({
      base: 0,
      accuracyBonus: 0,
      streakBonus: 0,
      total: 0,
    })
  })

  it("rejects impossible counts, so a request can't claim more than she answered", () => {
    for (const [correct, answered] of [
      [-1, 3],
      [2.5, 3],
      [4, 3],
      [500, 3],
      [5, 20], // all 20 answered is a finished assignment, not leaving early
    ])
      expect(
        () => leftEarlyPayout({ correct, answered, problemCount: 20 }),
        `${correct}/${answered}`,
      ).toThrow(RangeError)
  })
})
