import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Device, ResultRow, Summary } from '../../parent/api'
import { Overview } from './Overview'

const TODAY = '2026-10-17'
const noop = () => {}
const at = (m: number, d: number, h: number, min: number) => new Date(2026, m, d, h, min).toISOString()

const summary = (over: Partial<Summary> = {}): Summary => ({
  balance: 41,
  streak: 3,
  lastDay: '2026-10-16',
  completed: 5,
  earnedToday: 0,
  completedToday: 0,
  ...over,
})

const row = (over: Partial<ResultRow> = {}): ResultRow => ({
  id: 1,
  day: TODAY,
  answered: 20,
  correct: 20,
  finished: true,
  grade: 'Excellent',
  total: 24,
  createdAt: at(9, 17, 16, 5),
  ...over,
})

const device = (over: Partial<Device> = {}): Device => ({
  id: 1,
  label: 'Her iPad',
  createdAt: at(9, 1, 9, 0),
  revokedAt: null,
  lastResultAt: at(9, 17, 16, 5),
  ...over,
})

const render = (
  over: {
    summary?: Summary | null
    results?: ResultRow[] | null
    devices?: Device[] | null
    childName?: string | null
    today?: string
    now?: Date
  } = {},
) =>
  renderToStaticMarkup(
    <Overview
      summary={'summary' in over ? over.summary! : summary()}
      results={'results' in over ? over.results! : []}
      devices={'devices' in over ? over.devices! : [device()]}
      childName={'childName' in over ? over.childName! : 'Ada'}
      today={over.today ?? TODAY}
      now={over.now ?? new Date()}
      onGo={noop}
      pending="…"
      unavailable={null}
    />,
  )

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 9, 17, 18, 0))
})
afterEach(() => vi.useRealTimers())

describe('Overview', () => {
  it('O7: the hero count reads with its unit, with no total and no progress bar', () => {
    const cases: [number, string][] = [
      [0, '0</span><span class="overview-hero-unit">assignments done'],
      [1, '1</span><span class="overview-hero-unit">assignment done'],
      [2, '2</span><span class="overview-hero-unit">assignments done'],
      [1234, '1,234</span><span class="overview-hero-unit">assignments done'],
    ]
    for (const [n, text] of cases) {
      const html = render({ summary: summary({ completedToday: n }) })
      expect(html, String(n)).toContain(text)
      expect(html).not.toContain(' of ')
      expect(html).not.toMatch(/progress/)
    }
  })

  it('shows the earned line only when she earned something today', () => {
    expect(render()).not.toContain('earned today')
    expect(render({ summary: summary({ earnedToday: 54 }) })).toContain('54 Macaronis earned today.')
  })

  it('O8: lists the assignments she finished today, or says there are none', () => {
    const html = render({
      results: [
        row({ id: 1 }),
        row({ id: 2, finished: false, grade: null, total: 7 }),
        row({ id: 3, day: '2026-10-16', total: 11 }),
      ],
    })
    expect(html).toContain('Assignment · Excellent')
    expect(html).toContain('Completed today, 4:05 pm')
    expect(html).toContain('+24')
    expect(html).not.toContain('+7<')
    expect(html).not.toContain('+11<')
    expect(html).not.toContain('No assignments yet today.')
    expect(render({ results: [] })).toContain('No assignments yet today.')
  })

  it('O9: the devices row counts connected devices and says when the latest synced', () => {
    const html = render({
      devices: [
        device({ id: 1, lastResultAt: at(9, 12, 10, 0) }),
        device({ id: 2, lastResultAt: at(9, 17, 16, 5) }),
        device({ id: 3, revokedAt: at(9, 14, 8, 0), lastResultAt: at(9, 17, 17, 30) }),
      ],
    })
    expect(html).toContain('2 connected devices')
    expect(html).toContain('Last synced today, 4:05 pm')
    expect(render({ devices: [device({ lastResultAt: null })] })).toContain('1 connected device<')
    expect(render({ devices: [] })).toContain('0 connected devices')
    expect(render({ devices: [] })).toContain('No results yet')
  })

  it('O10: the rewards row counts the rewards within reach, never with "of"', () => {
    const cases: [number | null, string][] = [
      [41, '4 rewards · 1 within reach'],
      [29, '4 rewards<'],
      [30, '4 rewards · 1 within reach'],
      [10000, '4 rewards · 4 within reach'],
      [null, '4 rewards<'],
    ]
    for (const [balance, text] of cases) {
      const html = render({ summary: balance === null ? null : summary({ balance }) })
      expect(html, String(balance)).toContain(text)
      expect(html).not.toMatch(/\d+ of \d+/)
      if (balance === null || balance < 30) expect(html).not.toContain('within reach')
    }
  })

  it('O11: the four shortcuts are real links to their screens', () => {
    const html = render()
    expect(html).toMatch(/href="\/parent\/points"[^>]*>Manage Macaronis →</)
    expect(html).toMatch(/href="\/parent\/streak"[^>]*>Manage streak →</)
    expect(html).toMatch(/href="\/parent\/devices"/)
    expect(html).toMatch(/href="\/parent\/shop"/)
  })

  it('follows the today and now it is given, not the system clock', () => {
    // The system clock says Oct 17, 6 pm; the numbers were read on Oct 18.
    const results = [row({ id: 1, day: TODAY }), row({ id: 2, day: '2026-10-18', total: 33 })]
    const devices = [device({ lastResultAt: at(9, 17, 16, 5) })]
    const html = render({ results, devices, today: '2026-10-18', now: new Date(2026, 9, 18, 0, 5) })
    expect(html).toContain('+33')
    expect(html).not.toContain('+24')
    expect(html).toContain('Last synced Oct 17')
    expect(html).not.toContain('Last synced today')
  })

  it('shows the selected child’s numbers and totals', () => {
    const html = render({ summary: summary({ balance: 1234, streak: 1 }) })
    expect(html).toContain('1,234')
    expect(html).toContain('1 day<')
    expect(html).toContain('5 assignments done in all · Last counted day Oct 16')
    expect(render({ summary: summary({ lastDay: null }) })).toContain('Last counted day None yet')
  })

  it('shows the pending marker while the numbers and devices have not arrived', () => {
    const html = render({ summary: null, devices: null, results: null })
    expect(html).not.toContain('NaN')
    expect(html).toContain('…')
    expect(html).not.toContain('connected device')
  })

  it('names the shop after the child, or plainly with no name', () => {
    expect(render()).toContain('Ada&#x27;s rewards shop')
    const plain = render({ childName: null })
    expect(plain).toContain('Rewards shop')
    expect(plain).not.toContain('null')
  })

  it('lists her results below', () => {
    const html = render({ results: [row({ finished: false, grade: null })] })
    expect(html).toContain('id="overview-results"')
    expect(html).toContain('Left early')
  })
})
