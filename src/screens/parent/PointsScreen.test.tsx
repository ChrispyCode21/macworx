import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { checkAdjust, parseAmount, balanceAfter } from '../../parent/adjust'
import type { LogEntry, Summary } from '../../parent/api'
import { PointsScreen } from './PointsScreen'
import { visibleStep } from './useAdjust'
import type { AdjustState } from './useAdjust'

const noop = () => {}

/** The hook's result for a form state, worked out the way the hook does. */
function adjustState(
  over: Partial<Pick<AdjustState, 'removing' | 'amountText' | 'note' | 'step' | 'notice' | 'problem'>> = {},
  balance: number | null = 40,
): AdjustState {
  const s = {
    removing: false,
    amountText: '',
    note: '',
    step: 'form' as const,
    notice: null,
    problem: null,
    ...over,
  }
  const count = parseAmount(s.amountText)
  const amount = count === null ? null : s.removing ? -count : count
  const after = amount === null || balance === null ? null : balanceAfter(balance, amount)
  const check = balance === null ? null : checkAdjust({ ...s, balance })
  return {
    ...s,
    step: visibleStep(s.step, check),
    saving: false,
    amount,
    after,
    below: after !== null && after < 0,
    check,
    setRemoving: noop,
    setAmountText: noop,
    setNote: noop,
    review: noop,
    back: noop,
    confirm: async () => {},
  }
}

const summary = (over: Partial<Summary> = {}): Summary => ({
  balance: 40,
  streak: 3,
  lastDay: null,
  completed: 2,
  earnedToday: 0,
  completedToday: 0,
  ...over,
})

const entry = (id: number, action: string, detail: Record<string, unknown>): LogEntry => ({
  id,
  at: '2026-10-16T15:05:00.000Z',
  email: 'mom@example.com',
  action,
  detail,
})

const render = (adjust: AdjustState, log: LogEntry[] | null = [], s: Summary | null = summary()) =>
  renderToStaticMarkup(
    <PointsScreen
      summary={s}
      log={log}
      devices={[]}
      adjust={adjust}
      unavailable={<p>Not here</p>}
      pending="…"
    />,
  )

describe('PointsScreen hero and form', () => {
  it('hides the earned-today line at 0 and shows it otherwise', () => {
    expect(render(adjustState())).not.toContain('earned today')
    expect(render(adjustState(), [], summary({ earnedToday: 12 }))).toContain('+12 earned today')
  })

  it('keeps Review disabled and plain until the amount and reason are valid', () => {
    const plain = render(adjustState())
    expect(plain).toMatch(/<button[^>]*disabled[^>]*>Review</)
    const noReason = render(adjustState({ amountText: '20' }))
    expect(noReason).toMatch(/<button[^>]*disabled[^>]*>Review \+20 Macaronis/)
    const ready = render(adjustState({ amountText: '20', note: 'Homework grades' }))
    expect(ready).toMatch(/<button(?![^>]*disabled)[^>]*>Review \+20 Macaronis/)
    expect(ready).toContain('60 Macaronis')
  })

  it('says Macaroni for 1 and uses the real minus sign for Remove', () => {
    expect(render(adjustState({ amountText: '1', note: 'x' }))).toContain('Review +1 Macaroni<')
    expect(render(adjustState({ removing: true, amountText: '5', note: 'x' }))).toContain(
      'Review −5 Macaronis',
    )
  })

  it('refuses a removal bigger than her balance before any request', () => {
    const html = render(adjustState({ removing: true, amountText: '41', note: 'Fixing the count' }))
    expect(html).toContain('Can&#x27;t go below zero.')
    expect(html).toContain('She has 40 Macaronis, so you can&#x27;t remove more than that.')
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Review −41 Macaronis/)
  })

  it('refuses it even while the reason is still empty', () => {
    const html = render(adjustState({ removing: true, amountText: '41' }))
    expect(html).toContain('She has 40 Macaronis')
  })

  it('shows the amount and reason labels for the chosen mode', () => {
    expect(render(adjustState())).toContain('Macaronis to add')
    expect(render(adjustState({ removing: true }))).toContain('Macaronis to remove')
  })
})

describe('PointsScreen Review step', () => {
  const reviewing = (over = {}) =>
    adjustState({ amountText: '20', note: 'Homework grades', step: 'review', ...over })

  it('restates the change, offers Confirm and Back, and locks the fields', () => {
    const html = render(reviewing())
    expect(html).toContain('Add 20 Macaronis: balance 40 → 60. Reason: Homework grades.')
    expect(html).toContain('>Confirm<')
    expect(html).toContain('>Back<')
    expect(html).not.toContain('>Review +20')
    const tags = html.match(/<(input|textarea)\b[^>]*>/g) ?? []
    expect(tags.length).toBe(2)
    for (const tag of tags) expect(tag).toContain('disabled')
    expect(html).toMatch(/role="radio"[^>]*disabled/)
  })

  it('restates a removal', () => {
    const html = render(reviewing({ removing: true, amountText: '15' }))
    expect(html).toContain('Remove 15 Macaronis: balance 40 → 25.')
  })

  it('unlocks the form when the balance moved so the change would overdraw', () => {
    const html = render(reviewing({ removing: true, amountText: '41' }))
    expect(html).not.toContain('>Confirm<')
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Review −41 Macaronis/)
    for (const tag of html.match(/<(input|textarea)\b[^>]*>/g) ?? []) expect(tag).not.toContain('disabled')
    expect(html).not.toMatch(/role="radio"[^>]*disabled/)
    expect(html).toContain('She has 40 Macaronis')
  })

  it('says the overdraw line once when a refusal is showing', () => {
    const line = 'She has 40 Macaronis, so you can&#x27;t remove more than that.'
    const problem = "She has 40 Macaronis, so you can't remove more than that. Her balance can't go below 0."
    const html = render(adjustState({ removing: true, amountText: '41', note: 'x', problem }))
    expect(html.split(line).length - 1).toBe(1)
    expect(html).toContain('role="alert"')
  })

  it('shows the saved notice and the refusal as separate lines', () => {
    expect(render(adjustState({ notice: 'Saved. Her balance is now 60.' }))).toMatch(
      /role="status"[\s\S]*Saved\. Her balance is now 60\./,
    )
    expect(render(adjustState({ problem: 'That did not save.' }))).toMatch(
      /role="alert"[\s\S]*That did not save\./,
    )
  })
})

describe('PointsScreen Recent activity', () => {
  it('shows a balance row with its signed amount and no balance line', () => {
    const html = render(adjustState(), [
      entry(1, 'balance', { amount: 20, before: 40, after: 60, note: 'Homework grades' }),
      entry(2, 'balance', { amount: -15, before: 60, after: 45, note: 'Counted twice' }),
    ])
    expect(html).toContain('>+20<')
    expect(html).toContain('>−15<')
    expect(html).toContain('Added 20 Macaronis: Homework grades')
    expect(html).toContain('mom@example.com')
    expect(html).not.toMatch(/Balance \d/)
    expect(html).not.toContain('Full history')
  })

  it('gives other kinds of row no amount', () => {
    const html = render(adjustState(), [
      entry(1, 'streak', { after: { streak: 4, lastDay: '2026-10-15' } }),
      entry(2, 'pairing_code', { name: 'Kitchen iPad' }),
      entry(3, 'mystery', {}),
    ])
    expect(html).toContain('Made a pairing code for Kitchen iPad')
    expect(html).toContain('Made a change')
    expect(html).not.toContain('activity-amount')
  })

  it('shows the empty line, the unavailable line and the latest-50 note', () => {
    expect(render(adjustState(), [])).toContain('Nothing here yet.')
    expect(render(adjustState(), null)).toContain('Not here')
    const fifty = Array.from({ length: 50 }, (_, i) => entry(i + 1, 'mystery', {}))
    expect(render(adjustState(), fifty)).toContain('Showing the latest 50.')
    expect(render(adjustState(), fifty.slice(0, 49))).not.toContain('Showing the latest')
  })
})
