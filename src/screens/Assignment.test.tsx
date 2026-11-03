import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { HomeNumbers, PracticeChild } from '../sync/projection'
import { Assignment } from './Assignment'

const NUMBERS: HomeNumbers = { balance: 40, completed: 2, streak: 3, latestGrade: null }
const render = (numbers?: HomeNumbers) =>
  renderToStaticMarkup(<Assignment seed={1} numbers={numbers} onFinish={() => {}} onLeave={() => {}} />)

describe('Assignment frame', () => {
  it('opens on problem 1 of 20 with the top bar, the crumb and a disabled Check', () => {
    const html = render(NUMBERS)
    expect(html).toContain('40 Macaronis')
    expect(html).toContain('3 days')
    expect(html).toContain('Practice  /  Math')
    expect(html).toContain('A little practice, a little progress.')
    expect(html).toContain('Problem 1 of 20')
    expect(html).toContain('aria-valuenow="1"')
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*class="button button-action"|class="button button-action"[^>]*disabled=""/,
    )
    expect(html).toContain('Take your time. There&#x27;s no timer.')
  })

  it('shows her avatar and "{name} · {grade}" from the child it opens with', () => {
    const child: PracticeChild = { name: 'Ada', grade: '4th grade', initials: 'AL' }
    const html = renderToStaticMarkup(
      <Assignment seed={1} numbers={NUMBERS} child={child} onFinish={() => {}} onLeave={() => {}} />,
    )
    expect(html).toContain('>AL<')
    expect(html).toContain('Ada · 4th grade')
  })

  it('has no Check key on the pad and no Done for now button beside the progress', () => {
    const html = render()
    expect(html).not.toContain('button-check')
    expect(html).not.toContain('button-secondary')
    expect(html).not.toContain('Macaroni')
  })
})
