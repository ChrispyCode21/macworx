import { describe, expect, it } from 'vitest'
import { payout } from './payout'
import { addDays, dayNumber, nextStreak, type StreakState } from './streak'

const TODAY = '2026-10-17'

/** Finish one all-correct assignment today and return the streak and its streak bonus. */
function finish(state: StreakState, today = TODAY) {
  const result = nextStreak(state, today)
  const { streakBonus } = payout({ correct: 20, problemCount: 20, ...result })
  return { ...result, streakBonus }
}

/** A first finished assignment of the day: today becomes the last counted day. */
const counted = (streak: number, streakBonus: number) => ({
  streak,
  lastDay: TODAY,
  firstOfDay: true,
  streakBonus,
})

describe('streak (SPEC §6.5)', () => {
  it('S1: no assignment ever finished → streak 1, bonus +1', () => {
    expect(finish({ streak: 0, lastDay: null })).toEqual({
      streak: 1,
      lastDay: TODAY,
      firstOfDay: true,
      streakBonus: 1,
    })
  })

  it('S2: streak 6, last counted yesterday → streak 7, bonus +7', () => {
    expect(finish({ streak: 6, lastDay: '2026-10-16' })).toEqual(counted(7, 7))
  })

  it('S3: streak 9, last counted yesterday → streak 10, bonus +10', () => {
    expect(finish({ streak: 9, lastDay: '2026-10-16' })).toEqual(counted(10, 10))
  })

  it('S4: streak 14, last counted yesterday → streak 15, bonus capped at +10', () => {
    expect(finish({ streak: 14, lastDay: '2026-10-16' })).toEqual(counted(15, 10))
  })

  it('S5: second assignment of the day → streak stays 7, bonus +0', () => {
    expect(finish({ streak: 7, lastDay: TODAY })).toEqual({
      streak: 7,
      lastDay: TODAY,
      firstOfDay: false,
      streakBonus: 0,
    })
  })

  it('S6: streak 12, last counted 2 days ago → starts over at 1, bonus +1', () => {
    expect(finish({ streak: 12, lastDay: '2026-10-15' })).toEqual(counted(1, 1))
  })

  it('S7: last counted day is tomorrow (clock set back) → same as the same day', () => {
    expect(finish({ streak: 5, lastDay: '2026-10-18' })).toEqual({
      streak: 5,
      lastDay: '2026-10-18',
      firstOfDay: false,
      streakBonus: 0,
    })
  })

  it('S8: last counted day 3 days after today (clock had jumped ahead) → starts over at 1, bonus +1', () => {
    expect(finish({ streak: 5, lastDay: '2026-10-20' })).toEqual(counted(1, 1))
  })

  it('treats exactly 1 day ahead as the same day, and 2 days ahead as starting over', () => {
    expect(nextStreak({ streak: 5, lastDay: '2026-10-18' }, TODAY)).toMatchObject({
      streak: 5,
      firstOfDay: false,
    })
    expect(nextStreak({ streak: 5, lastDay: '2026-10-19' }, TODAY)).toEqual({
      streak: 1,
      lastDay: TODAY,
      firstOfDay: true,
    })
  })

  it('continues across month, year and leap-day boundaries', () => {
    for (const [last, today] of [
      ['2026-10-31', '2026-11-01'],
      ['2026-12-31', '2027-01-01'],
      ['2028-02-28', '2028-02-29'],
      ['2028-02-29', '2028-03-01'],
      ['2027-02-28', '2027-03-01'],
    ]) {
      expect(nextStreak({ streak: 3, lastDay: last }, today).streak, `${last} → ${today}`).toBe(4)
    }
  })

  it('starts over after a gap across a month boundary', () => {
    expect(nextStreak({ streak: 3, lastDay: '2026-10-30' }, '2026-11-01').streak).toBe(1)
  })

  it('counts days like the calendar', () => {
    expect(dayNumber('1970-01-01')).toBe(0)
    expect(dayNumber('2000-03-01') - dayNumber('2000-02-28')).toBe(2)
    expect(dayNumber('2100-03-01') - dayNumber('2100-02-28')).toBe(1)
  })

  it('adds and subtracts days across month, year and leap-day boundaries', () => {
    expect(addDays('2026-10-17', 1)).toBe('2026-10-18')
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDays('2100-02-28', 1)).toBe('2100-03-01')
    expect(addDays('2000-02-28', 1)).toBe('2000-02-29')
    expect(addDays('1970-01-01', 0)).toBe('1970-01-01')
  })

  it('round-trips every day for a few years', () => {
    for (let n = dayNumber('2025-01-01'); n < dayNumber('2030-01-01'); n++) {
      const day = addDays('1970-01-01', n)
      expect(dayNumber(day)).toBe(n)
    }
  })

  it('rejects a fractional number of days', () => {
    expect(() => addDays('2026-10-17', 0.5)).toThrow(RangeError)
  })

  it('rejects a stored streak that is negative or not a whole number', () => {
    for (const streak of [-3, 1.5, Number.NaN])
      expect(() => nextStreak({ streak, lastDay: '2026-10-16' }, TODAY), String(streak)).toThrow(RangeError)
  })

  it('rejects dates that are not YYYY-MM-DD calendar days', () => {
    for (const bad of ['2026-02-29', '2026-13-01', '2026-00-10', '2026-10-32', '17/10/2026', ''])
      expect(() => nextStreak({ streak: 1, lastDay: null }, bad), bad).toThrow(RangeError)
  })
})
