import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { COPY } from '../../copy'
import type { HomeNumbers, PracticeChild } from '../../sync/projection'
import { SpellingPractice } from './SpellingPractice'

// There is no DOM here, so these check the screen as it opens. Tapping through the 8 words is in e2e/spelling.spec.ts.
// With no `window`, the iPad "can't speak", which is the no-speech state.
const NUMBERS: HomeNumbers = { balance: 40, completed: 2, streak: 3, latestGrade: null }
const render = (numbers?: HomeNumbers, child?: PracticeChild | null) =>
  renderToStaticMarkup(<SpellingPractice numbers={numbers} child={child} onBack={() => {}} />)

describe('SpellingPractice', () => {
  it('opens on word 1 of 8 with the crumb, the title and the note', () => {
    const html = render(NUMBERS)
    expect(html).toContain('40 Macaronis')
    expect(html).toContain('Practice  /  Spelling')
    expect(html).toContain('Listen closely. Choose confidently.')
    expect(html).toContain('Word 1 of 8')
    expect(html).toContain('aria-valuenow="1"')
    expect(html).toContain('aria-valuemax="8"')
    expect(html).toContain(COPY.spellingNote)
  })

  it('shows the four choices of the first word, lettered A to D, none chosen', () => {
    const html = render()
    expect(html).toContain('role="radiogroup"')
    for (const word of ['frend', 'freind', 'friend', 'frind']) expect(html).toContain(`>${word}<`)
    for (const letter of ['A', 'B', 'C', 'D']) expect(html).toContain(`>${letter}</span>`)
    expect(html.match(/role="radio"/g)).toHaveLength(4)
    expect(html.match(/aria-checked="false"/g)).toHaveLength(4)
    expect(html).not.toContain('data-result')
    expect(html).toContain(COPY.spellingChooseOne)
  })

  it('disables Check until a choice is made', () => {
    expect(render()).toMatch(
      /<button[^>]*disabled=""[^>]*class="button button-action"|class="button button-action"[^>]*disabled=""/,
    )
  })

  it('disables both Play buttons and says why when the iPad cannot speak, with the choices still open', () => {
    const html = render()
    expect(html).toContain(COPY.playUnavailable.replace("'", '&#x27;'))
    expect(html).not.toContain(COPY.playWordSub)
    expect(html).toMatch(/aria-label="Play word"[^>]*disabled=""|disabled=""[^>]*aria-label="Play word"/)
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*class="button button-support"|class="button button-support"[^>]*disabled=""/,
    )
    expect(html).not.toMatch(/role="radio"[^>]*disabled=""/)
  })

  it('shows her avatar and name from the child it opens with', () => {
    const html = render(NUMBERS, { name: 'Ada', grade: '4th grade', initials: 'AL' })
    expect(html).toContain('>AL<')
    expect(html).toContain('⁨Ada⁩ · ⁨4th grade⁩')
  })
})
