import { describe, expect, it } from 'vitest'
import type { Device, ResultRow } from './api'
import { connectedDevices, lastSyncedLine, OVERVIEW_LINKS, todaysAssignments } from './overview'

// Today is the browser's local 2026-10-17 (SPEC §7.O); timestamps are local times.
const NOW = new Date(2026, 9, 17, 18, 0)
const at = (m: number, d: number, h: number, min: number) => new Date(2026, m, d, h, min).toISOString()

const result = (over: Partial<ResultRow>): ResultRow => ({
  id: 1,
  day: '2026-10-17',
  answered: 20,
  correct: 20,
  finished: true,
  grade: 'Excellent',
  total: 24,
  createdAt: at(9, 17, 16, 5),
  ...over,
})

const device = (over: Partial<Device>): Device => ({
  id: 1,
  label: 'Her iPad',
  createdAt: at(9, 1, 9, 0),
  revokedAt: null,
  lastResultAt: null,
  ...over,
})

describe('Overview helpers (SPEC §7.O)', () => {
  it('O8: lists only the finished results of today', () => {
    const today = result({ id: 1 })
    const early = result({ id: 2, finished: false, grade: null })
    const yesterday = result({ id: 3, day: '2026-10-16' })
    expect(todaysAssignments([today, early, yesterday], '2026-10-17')).toEqual([today])
    expect(todaysAssignments([early, yesterday], '2026-10-17')).toEqual([])
  })

  it('O9: counts connected devices and takes the latest sync of those only', () => {
    const devices = [
      device({ id: 1, lastResultAt: at(9, 12, 10, 0) }),
      device({ id: 2, lastResultAt: at(9, 17, 16, 5) }),
      device({ id: 3, revokedAt: at(9, 14, 8, 0), lastResultAt: at(9, 17, 17, 30) }),
    ]
    const got = connectedDevices(devices)
    expect(got).toEqual({ count: 2, lastSyncedAt: at(9, 17, 16, 5) })
    expect(lastSyncedLine(got.lastSyncedAt, NOW)).toBe('Last synced today, 4:05 pm')

    const older = connectedDevices([devices[0], devices[2]])
    expect(older.count).toBe(1)
    expect(lastSyncedLine(older.lastSyncedAt, NOW)).toBe('Last synced Oct 12')

    const none = connectedDevices([device({})])
    expect(none).toEqual({ count: 1, lastSyncedAt: null })
    expect(lastSyncedLine(none.lastSyncedAt, NOW)).toBe('No results yet')
    expect(connectedDevices([devices[2]])).toEqual({ count: 0, lastSyncedAt: null })
    expect(connectedDevices([])).toEqual({ count: 0, lastSyncedAt: null })
  })

  it('O11: each shortcut opens its own screen', () => {
    expect(OVERVIEW_LINKS).toEqual({
      macaronis: 'points',
      streak: 'streak',
      devices: 'devices',
      shop: 'shop',
    })
  })
})
