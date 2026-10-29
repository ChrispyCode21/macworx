import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  adjustBalance,
  chooseChild,
  getChildren,
  getSummary,
  listDevices,
  listLog,
  listResults,
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
      'GET /api/parent/summary?child=2',
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
      'GET /api/parent/summary?child=5',
      'GET /api/parent/log?child=5',
    ])
  })

  it('fails without a child call when the household has no children', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ children: [] }), { status: 200 }))
    expect(await getSummary()).toEqual({ ok: false, status: 404, error: 'no_child' })
    expect(called()).toEqual(['GET /api/parent/children'])
  })
})
