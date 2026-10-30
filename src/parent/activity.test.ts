import { describe as suite, expect, it } from 'vitest'
import { COPY } from '../copy'
import { formatCalendarDay } from '../ui/format'
import { describe } from './activity'
import type { Device, LogEntry } from './api'

const entry = (action: string, detail: Record<string, unknown>): LogEntry => ({
  id: 1,
  at: '2026-10-30T10:00:00.000Z',
  email: 'parent@example.com',
  action,
  detail,
})

const devices: Device[] = [
  {
    id: 7,
    label: 'Kitchen iPad',
    createdAt: '2026-10-01T00:00:00.000Z',
    revokedAt: null,
    lastResultAt: null,
  },
]

suite('describe', () => {
  it('reads a balance addition with its signed amount', () => {
    expect(
      describe(entry('balance', { amount: 20, before: 40, after: 60, note: 'Homework grades' }), []),
    ).toEqual({
      kind: 'balance',
      title: COPY.parentLogAdded(20, 'Homework grades'),
      amount: 20,
    })
  })

  it('reads a balance removal with its signed amount', () => {
    expect(describe(entry('balance', { amount: -15, note: 'Counted twice' }), [])).toEqual({
      kind: 'balance',
      title: COPY.parentLogRemoved(15, 'Counted twice'),
      amount: -15,
    })
  })

  it('keeps the amount of a balance entry whose note is missing', () => {
    expect(describe(entry('balance', { amount: 5 }), [])).toEqual({
      kind: 'balance',
      title: COPY.parentLogOther,
      amount: 5,
    })
  })

  it('gives no amount for a balance entry whose amount is not a number', () => {
    expect(describe(entry('balance', { amount: '5', note: 'x' }), [])).toEqual({
      kind: 'balance',
      title: COPY.parentLogOther,
    })
  })

  it('reads a streak and a pairing code', () => {
    expect(describe(entry('streak', { after: { streak: 4, lastDay: '2026-10-29' } }), [])).toEqual({
      kind: 'streak',
      title: COPY.parentLogStreak(4, '2026-10-29'),
    })
    expect(describe(entry('pairing_code', { name: 'Hall iPad' }), [])).toEqual({
      kind: 'pairing_code',
      title: COPY.parentLogPairingCode('Hall iPad'),
    })
  })

  it('reads an unpair with a known and an unknown device', () => {
    expect(describe(entry('unpair', { deviceId: 7 }), devices)).toEqual({
      kind: 'unpair',
      title: COPY.parentLogUnpair('Kitchen iPad'),
    })
    expect(describe(entry('unpair', { deviceId: 8 }), devices)).toEqual({
      kind: 'unpair',
      title: COPY.parentLogUnpair(COPY.parentLogUnknownDevice),
    })
  })

  it('still reads an old correction entry', () => {
    const detail = {
      day: '2026-10-20',
      before: { correct: 3, total: 10 },
      after: { correct: 5, total: 14 },
      note: 'Marked wrong',
    }
    expect(describe(entry('correction', detail), [])).toEqual({
      kind: 'correction',
      title: COPY.parentLogCorrected(formatCalendarDay('2026-10-20'), 3, 5, 4, 'Marked wrong'),
    })
  })

  it('reads child additions and renames', () => {
    expect(describe(entry('child_add', { name: 'Mia' }), [])).toEqual({
      kind: 'child',
      title: COPY.parentLogChildAdded('Mia'),
    })
    expect(describe(entry('child_rename', { before: { name: 'Mia' }, after: { name: 'Maya' } }), [])).toEqual(
      {
        kind: 'child',
        title: COPY.parentLogChildRenamed('Mia', 'Maya'),
      },
    )
    expect(describe(entry('child_rename', { before: { name: 'Mia' }, after: { name: 'Mia' } }), [])).toEqual({
      kind: 'child',
      title: COPY.parentLogChildChanged('Mia'),
    })
  })

  it('reads an unknown action as other', () => {
    expect(describe(entry('mystery', { amount: 3 }), [])).toEqual({
      kind: 'other',
      title: COPY.parentLogOther,
    })
  })

  it('gives an amount only for balance entries', () => {
    for (const action of ['streak', 'pairing_code', 'unpair', 'correction', 'child_add', 'mystery'])
      expect(describe(entry(action, { amount: 9 }), [])).not.toHaveProperty('amount')
  })
})
