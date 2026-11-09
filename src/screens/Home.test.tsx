import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { HomeNumbers } from '../sync/projection'
import { Home } from './Home'

const NUMBERS: HomeNumbers = { balance: 55, completed: 3, streak: 1, latestGrade: 'Good' }
const render = (props: Partial<Parameters<typeof Home>[0]> = {}) =>
  renderToStaticMarkup(<Home onStart={() => {}} onOpen={() => {}} {...props} />)

describe('Home (SPEC §5.1 step 1)', () => {
  it('has a Start button for Math, Spelling and Reading, and the page text', () => {
    const html = render()
    for (const name of ['Math', 'Spelling', 'Reading']) expect(html).toContain(`aria-label="Start ${name}"`)
    for (const text of [
      'Ready for a little progress?',
      'What would you like to practice?',
      '3 subjects',
      'Your progress',
      'A little effort. A little reward.',
      'Explore the shop',
      'Take your time. You&#x27;ve got this.',
      'Grown-up settings live in Parents.',
    ])
      expect(html).toContain(text)
    expect(html).toContain('href="/parent/overview"')
  })

  it('shows the balance and streak, and not completed assignments or the grade', () => {
    const html = render({ numbers: NUMBERS })
    expect(html).toContain('>55<')
    expect(html).toContain('available to spend')
    expect(html).toContain('>1 day<')
    expect(html).toContain('Current streak')
    expect(html).not.toContain('assignments done')
    expect(html).not.toContain('Latest')
  })

  it('leaves out the streak and its divider when there is none to show', () => {
    const html = render({ numbers: { ...NUMBERS, streak: null } })
    expect(html).toContain('>55<')
    expect(html).not.toContain('Current streak')
    expect(html).not.toContain('home-streak')
  })

  it('shows a friendly line and no number before there are numbers', () => {
    const html = render()
    expect(html).toContain('Your Macaronis will show up here.')
    expect(html).not.toContain('available to spend')
    expect(html).not.toContain('home-balance')
    expect(html).not.toContain('Current streak')
  })

  it('shows the Wi-Fi line on Math only when there are no seeds', () => {
    expect(render()).toContain('20 problems. Take your time.')
    const html = render({ noSeeds: true })
    expect(html).toContain('Connect to Wi-Fi to get more problems!')
    expect(html).not.toContain('20 problems. Take your time.')
  })

  it('shows the two Shop controls but they do nothing yet', () => {
    const html = render()
    expect(html.match(/aria-disabled="true"/g)).toHaveLength(2)
    expect(html).not.toContain('href="/shop')
  })

  it('shows Pair this device only when asked', () => {
    expect(render()).not.toContain('Pair this device')
    expect(render({ onPair: () => {} })).toContain('Pair this device')
  })
})
