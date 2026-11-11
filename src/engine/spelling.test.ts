// Scoring and paying a spelling assignment (SPEC §6.3, §6.4, §7.E).
import { describe, expect, it } from 'vitest'
import { grade } from './grade'
import { leftEarlyPayout, payout, spellingPayout } from './payout'
import { checkSpelling, normalizeTyped, scoreSpelling } from './spelling'

describe('spellingPayout (SPEC §6.4)', () => {
  it('E1: 20 of 20 correct, first of the day, streak 1 → 25, Excellent', () => {
    expect(spellingPayout({ correct: 20, problemCount: 20, firstOfDay: true, streak: 1 })).toEqual({
      base: 20,
      accuracyBonus: 4,
      streakBonus: 1,
      total: 25,
    })
    expect(grade(20, 20)).toBe('Excellent')
  })

  it('E2: 15 of 20 correct, not first of the day → 18, Improving', () => {
    expect(spellingPayout({ correct: 15, problemCount: 20, firstOfDay: false, streak: 3 })).toEqual({
      base: 15,
      accuracyBonus: 3,
      streakBonus: 0,
      total: 18,
    })
    expect(grade(15, 20)).toBe('Improving')
  })

  it('E3: a list of 5 words, 4 correct → base 4, no bonus, 4, Good: never scaled up to 20', () => {
    const input = { correct: 4, problemCount: 5, firstOfDay: false, streak: 3 }
    expect(spellingPayout(input)).toEqual({ base: 4, accuracyBonus: 0, streakBonus: 0, total: 4 })
    expect(grade(4, 5)).toBe('Good')
    // The scaled payout of Math and Reading is unchanged: 4 of 5 is 16 + 3.
    expect(payout(input).total).toBe(19)
  })

  it('E4: 0 correct, not first of the day → raised to the minimum, 1', () => {
    expect(spellingPayout({ correct: 0, problemCount: 20, firstOfDay: false, streak: 3 }).total).toBe(1)
  })

  it('refuses a result that cannot be, as payout does', () => {
    expect(() => spellingPayout({ correct: 21, problemCount: 20, firstOfDay: false, streak: 0 })).toThrow(
      RangeError,
    )
    expect(() => spellingPayout({ correct: 1, problemCount: 0, firstOfDay: false, streak: 0 })).toThrow(
      RangeError,
    )
    expect(leftEarlyPayout({ correct: 3, answered: 5, problemCount: 20 }).total).toBe(3)
  })
})

describe('checking and scoring her typing (SPEC §6.3)', () => {
  it('E5: spaces and capitals do not matter', () => {
    expect(checkSpelling(' Favourite ', 'favourite')).toBe(true)
    expect(checkSpelling('FAVOURITE', 'Favourite')).toBe(true)
  })

  it('E6: an alternate is right, and without it the other spelling is not', () => {
    expect(checkSpelling('favorite', 'favourite', ['favorite'])).toBe(true)
    expect(checkSpelling('favorite', 'favourite')).toBe(false)
    expect(checkSpelling('favourite', 'favourite', ['favorite'])).toBe(true)
  })

  it('E7: a missing apostrophe is not right, and a curly one is', () => {
    expect(checkSpelling('dont', "don't")).toBe(false)
    expect(checkSpelling('don’t', "don't")).toBe(true)
    expect(checkSpelling("don't", 'don’t')).toBe(true)
    expect(checkSpelling('don‘t', "don't")).toBe(true)
  })

  it('a missing, extra or different letter is not right, and accents match however they are written', () => {
    for (const typed of ['becaus', 'becausee', 'becuase', ''])
      expect(checkSpelling(typed, 'because')).toBe(false)
    expect(checkSpelling('café', 'café')).toBe(true)
    expect(normalizeTyped('  ÉCOLE ')).toBe('école')
  })

  it('scoreSpelling counts the words right, and refuses typing that does not match the words', () => {
    const words = [{ word: 'because' }, { word: 'favourite', alternates: ['favorite'] }, { word: "don't" }]
    expect(scoreSpelling(words, ['because', 'Favorite', 'dont'])).toBe(2)
    expect(scoreSpelling(words, ['', '', ''])).toBe(0)
    expect(() => scoreSpelling(words, ['because'])).toThrow(RangeError)
    expect(() => scoreSpelling([], [])).toThrow(RangeError)
  })
})
