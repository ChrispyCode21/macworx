import { describe, expect, it } from 'vitest'
import { formatRange, previewText, streakRange, weekStrip } from './streakDays'

const range = (streak: number, lastDay: string | null, cap?: number) => {
  const r = streakRange(streak, lastDay, cap)
  return r ? formatRange(r.start, r.end) : null
}

describe('last 7 days helpers (SPEC §7.T)', () => {
  it('T7: seven tiles ending today, with a check on counted days and on a counted today', () => {
    const tiles = weekStrip('2026-10-17', ['2026-10-15', '2026-10-16'])
    expect(tiles.map((t) => t.day)).toEqual([
      '2026-10-11',
      '2026-10-12',
      '2026-10-13',
      '2026-10-14',
      '2026-10-15',
      '2026-10-16',
      '2026-10-17',
    ])
    expect(tiles.map((t) => t.weekday).join('')).toBe('SMTWTFS')
    expect(tiles.map((t) => t.date)).toEqual([11, 12, 13, 14, 15, 16, 17])
    expect(tiles.map((t) => t.state)).toEqual(['idle', 'idle', 'idle', 'idle', 'counted', 'counted', 'today'])
    expect(tiles.map((t) => t.check)).toEqual([false, false, false, false, true, true, false])
    const counted = weekStrip('2026-10-17', ['2026-10-17'])
    expect(counted[6]).toMatchObject({ state: 'today', check: true })
  })

  it('T8: the range of a streak and its last counted day', () => {
    expect(range(3, '2026-10-16')).toBe('Oct 14–16')
    expect(range(7, '2026-10-16')).toBe('Oct 10–16')
    expect(range(20, '2026-10-16')).toBe('Sep 27–Oct 16')
    expect(range(20, '2026-10-16', 7)).toBe('Oct 10–16')
    expect(range(400, '2026-10-16')).toBe('Sep 12, 2025–Oct 16, 2026')
    expect(range(3, '2026-01-02')).toBe('Dec 31, 2025–Jan 2, 2026')
    expect(range(5, '2026-11-02')).toBe('Oct 29–Nov 2')
    expect(range(1, '2026-10-16')).toBe('Oct 16')
    expect(range(0, '2026-10-16')).toBeNull()
    expect(range(3, null)).toBeNull()
  })

  it('T9: the preview under the boxes', () => {
    expect(previewText(3, '7', '2026-10-16')).toBe('Preview: Oct 10–16 · 3 → 7 days')
    expect(previewText(3, '0', '')).toBe('Preview: no counted days · 3 → 0 days')
    expect(previewText(3, '1', '2026-10-16')).toBe('Preview: Oct 16 · 3 → 1 day')
    expect(previewText(3, '3', '')).toBeNull()
    expect(previewText(3, 'abc', '2026-10-16')).toBeNull()
  })
})
