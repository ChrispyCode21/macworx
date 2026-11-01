import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Summary } from '../../parent/api'
import { StreakScreen } from './StreakScreen'
import type { StreakFormState } from './useStreakForm'

const summary: Summary = { balance: 40, streak: 3, lastDay: '2026-10-16', completed: 5, earnedToday: 0 }
const noop = () => {}

const form = (over: Partial<StreakFormState> = {}): StreakFormState => ({
  streakText: '7',
  dayText: '2026-10-16',
  step: 'edit',
  saving: false,
  saved: false,
  problem: null,
  setStreakText: noop,
  setDayText: noop,
  review: noop,
  back: noop,
  confirm: async () => {},
  ...over,
})

const render = (
  over: Partial<StreakFormState> = {},
  s: Summary | null = summary,
  days: string[] | null = [],
) =>
  renderToStaticMarkup(
    <StreakScreen summary={s} days={days} problem={false} today="2026-10-17" form={form(over)} pending="…" />,
  )

describe('StreakScreen', () => {
  it('shows her streak, its range and the sample personal best', () => {
    const html = render()
    expect(html).toContain('3 days')
    expect(html).toContain('Current streak · Oct 14–16')
    expect(html).toContain('Personal best: 14 days')
    expect(html).toMatch(/Personal best: 14 days <span[^>]*>Sample<\/span>/)
  })

  it('shows Today ✓ only when the last counted day is today', () => {
    expect(render()).not.toContain('Today ✓')
    expect(render({}, { ...summary, lastDay: '2026-10-17' })).toContain('Today ✓')
  })

  it('draws seven tiles, October as the month, and a check on counted days', () => {
    const html = render({}, summary, ['2026-10-15', '2026-10-16'])
    expect(html.match(/streak-tile /g)).toHaveLength(7)
    expect(html).toContain('October')
    expect(html.match(/streak-tile-counted/g)).toHaveLength(2)
    expect(html.match(/<span class="visually-hidden">counted<\/span>/g)).toHaveLength(2)
  })

  it('says loading, not tiles, until the days arrive', () => {
    const html = render({}, summary, null)
    expect(html).toContain('Loading…')
    expect(html).not.toContain('streak-tile')
  })

  it('shows the preview and the Review button while editing', () => {
    const html = render()
    expect(html).toContain('Preview: Oct 10–16 · 3 → 7 days')
    expect(html).toContain('Review streak correction')
    expect(html).not.toContain('streak-confirm')
    expect(html).toContain('Corrected streak length')
  })

  it('in Review states the old and new values, locks the boxes and offers Confirm and Back', () => {
    const html = render({ step: 'review' })
    expect(html).toContain('Streak 3 → 7 days')
    expect(html).toContain('Last counted day Oct 16 → Oct 16')
    expect(html).toMatch(/streak-confirm.*>Confirm<\/button>.*>Back<\/button>/)
    expect(html).not.toContain('Review streak correction')
    const inputs = html.match(/<input\b[^>]*>/g) ?? []
    expect(inputs).toHaveLength(2)
    for (const tag of inputs) expect(tag).toContain('disabled')
  })

  it('shows the saved notice and a problem as announcements', () => {
    expect(render({ saved: true })).toMatch(/role="status"[^>]*>.*Streak saved\./)
    expect(render({ problem: 'That didn’t save.' })).toMatch(/role="alert"/)
  })

  it('disables the boxes and Review until her numbers arrive', () => {
    const html = render({ streakText: '', dayText: '' }, null)
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Review streak correction/)
  })
})
