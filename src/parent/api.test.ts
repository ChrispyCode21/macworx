import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  adjustBalance,
  chooseChild,
  getChildren,
  getDays,
  getSummary,
  listDevices,
  listLog,
  listResults,
  localDay,
  makeCode,
  setStreak,
  unpair,
} from './api'

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(new Response('{}', { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
  chooseChild(null)
})
afterEach(() => vi.unstubAllGlobals())

const called = () => fetchMock.mock.calls.map(([path, init]) => `${init?.method ?? 'GET'} ${path}`)

describe('the parent calendar day', () => {
  afterEach(() => vi.useRealTimers())

  it('zero-pads the month and day of the local date', () => {
    expect(localDay(new Date(2026, 0, 5, 9, 0))).toBe('2026-01-05')
  })

  it('getSummary sends the local day late in the evening', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 30, 23, 30))
    chooseChild(2)
    await getSummary()
    expect(called()).toEqual(['GET /api/parent/summary?child=2&today=2026-10-30'])
  })

  it('getDays sends the child and the local day', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 30, 23, 30))
    chooseChild(2)
    await getDays()
    expect(called()).toEqual(['GET /api/parent/days?child=2&today=2026-10-30'])
  })
})

describe('parent calls name the selected child', () => {
  it('adds ?child=<id> to every child-scoped call', async () => {
    chooseChild(2)
    await getSummary()
    await listResults()
    await listLog()
    await listDevices()
    await unpair(7)
    await setStreak(3, '2026-10-16')
    await adjustBalance(5, 'x')
    await makeCode('iPad')
    expect(called()).toEqual([
      `GET /api/parent/summary?child=2&today=${localDay()}`,
      'GET /api/parent/results?child=2',
      'GET /api/parent/log?child=2',
      'GET /api/parent/devices?child=2',
      'DELETE /api/parent/devices/7?child=2',
      'POST /api/parent/streak?child=2',
      'POST /api/parent/balance?child=2',
      'POST /api/parent/pairing-code?child=2',
    ])
  })

  it('lists children without a child id', async () => {
    chooseChild(2)
    await getChildren()
    expect(called()).toEqual(['GET /api/parent/children'])
  })

  it('chooses the first child when none is chosen yet', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ children: [{ id: 5 }, { id: 6 }] }), { status: 200 }),
    )
    await getSummary()
    await listLog()
    expect(called()).toEqual([
      'GET /api/parent/children',
      `GET /api/parent/summary?child=5&today=${localDay()}`,
      'GET /api/parent/log?child=5',
    ])
  })

  it('fails without a child call when the household has no children', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ children: [] }), { status: 200 }))
    expect(await getSummary()).toEqual({ ok: false, status: 404, error: 'no_child' })
    expect(called()).toEqual(['GET /api/parent/children'])
  })
})
