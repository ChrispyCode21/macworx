import { describe, expect, it } from 'vitest'
import { makeProblem } from '../engine'
import {
  formatCalendarDay,
  formatClock,
  formatEquation,
  formatLongDay,
  formatMoment,
  formatNumber,
  isSameLocalDay,
  operatorSymbol,
} from './format'

describe('formatClock', () => {
  // Built from local dates so the test holds in any time zone.
  it('writes the time with lowercase am/pm', () => {
    expect(formatClock(new Date(2026, 9, 17, 16, 5).toISOString())).toBe('4:05 pm')
    expect(formatClock(new Date(2026, 9, 17, 0, 9).toISOString())).toBe('12:09 am')
    expect(formatClock(new Date(2026, 9, 17, 23, 30).toISOString())).toBe('11:30 pm')
  })
})

describe('isSameLocalDay', () => {
  const now = new Date(2026, 9, 17, 18, 0)
  it('is true for any time on the same day', () => {
    expect(isSameLocalDay(new Date(2026, 9, 17, 0, 9).toISOString(), now)).toBe(true)
    expect(isSameLocalDay(new Date(2026, 9, 17, 23, 30).toISOString(), now)).toBe(true)
  })
  it('is false for another day', () => {
    expect(isSameLocalDay(new Date(2026, 9, 16, 23, 59).toISOString(), now)).toBe(false)
    expect(isSameLocalDay(new Date(2026, 9, 12, 9, 0).toISOString(), now)).toBe(false)
  })
})

describe('display formatting', () => {
  it('uses thousands separators', () => {
    expect(formatNumber(74885)).toBe('74,885')
    expect(formatNumber(0)).toBe('0')
  })

  it('uses the math symbols, not keyboard stand-ins', () => {
    expect(operatorSymbol('subtraction')).toBe('−')
    expect(operatorSymbol('multiplication')).toBe('×')
    expect(operatorSymbol('addition')).toBe('+')
  })

  it('writes a worked equation', () => {
    expect(formatEquation(makeProblem('subtraction', 74885, 27353))).toBe('74,885 − 27,353 = 47,532')
  })

  it('writes a calendar day without a time zone moving it', () => {
    expect(formatCalendarDay('2026-10-17')).toBe('Oct 17')
    expect(formatCalendarDay('2026-01-01')).toBe('Jan 1')
  })

  it('writes a long day for the portal heading', () => {
    expect(formatLongDay(new Date(2026, 9, 27))).toBe('Tuesday, October 27')
  })

  it('writes a moment with its time', () => {
    expect(formatMoment('2026-10-17T15:05:00')).toBe('Oct 17, 3:05 PM')
  })
})
