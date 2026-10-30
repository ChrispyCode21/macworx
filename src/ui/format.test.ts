import { describe, expect, it } from 'vitest'
import { makeProblem } from '../engine'
import {
  formatCalendarDay,
  formatEquation,
  formatLongDay,
  formatMoment,
  formatNumber,
  formatSynced,
  operatorSymbol,
} from './format'

describe('formatSynced', () => {
  // Built from local dates so the test holds in any time zone.
  const now = new Date(2026, 9, 17, 18, 0)
  it('says "No results yet" for a device with none', () => {
    expect(formatSynced(null, now)).toBe('No results yet')
  })
  it('writes the time, lowercase, for today', () => {
    expect(formatSynced(new Date(2026, 9, 17, 16, 5).toISOString(), now)).toBe('Synced today, 4:05 pm')
    expect(formatSynced(new Date(2026, 9, 17, 0, 9).toISOString(), now)).toBe('Synced today, 12:09 am')
  })
  it('treats a time later today as today', () => {
    expect(formatSynced(new Date(2026, 9, 17, 23, 30).toISOString(), now)).toBe('Synced today, 11:30 pm')
  })
  it('writes the date for any other day', () => {
    expect(formatSynced(new Date(2026, 9, 12, 9, 0).toISOString(), now)).toBe('Synced Oct 12')
    expect(formatSynced(new Date(2026, 9, 16, 23, 59).toISOString(), now)).toBe('Synced Oct 16')
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
