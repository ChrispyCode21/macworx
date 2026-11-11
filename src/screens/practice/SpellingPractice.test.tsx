import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { COPY } from '../../copy'
import type { HomeNumbers, PracticeChild } from '../../sync/projection'
import { SpellingPractice } from './SpellingPractice'

// There is no DOM here, so these check the screen as it opens. Tapping through the 8 words is in e2e/spelling.spec.ts.
const NUMBERS: HomeNumbers = { balance: 40, completed: 2, streak: 3, latestGrade: null }
const render = (numbers?: HomeNumbers, child?: PracticeChild | null) =>
  renderToStaticMarkup(<SpellingPractice numbers={numbers} child={child} onBack={() => {}} />)

describe('SpellingPractice', () => {
  it('opens on word 1 of 8 with the crumb, the title and the note', () => {
    const html = render(NUMBERS)
    expect(html).toContain('40 Macaronis')
    expect(html).toContain('Practice  /  Spelling')
    expect(html).toContain('Listen closely. Type carefully.')
    expect(html).toContain('Word 1 of 8')
    expect(html).toContain('aria-valuenow="1"')
    expect(html).toContain('aria-valuemax="8"')
    expect(html).toContain(COPY.spellingNote)
  })

  it('shows an empty word box with autocorrect, capitals and spell check off, and no choices', () => {
    const html = render()
    expect(html).toContain('type="text"')
    expect(html).toContain('autoCorrect="off"')
    expect(html).toContain('autoCapitalize="off"')
    expect(html).toContain('autoComplete="off"')
    expect(html).toContain('spellCheck="false"')
    expect(html).toContain('maxLength="100"')
    expect(html).toContain('value=""')
    expect(html).not.toContain('role="radio"')
    expect(html).not.toContain('data-result')
    expect(html).toContain(COPY.spellingTypeIt)
  })

  it('disables Check until something is typed, and has one Play button that works', () => {
    const html = render()
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*class="button button-action"|class="button button-action"[^>]*disabled=""/,
    )
    expect(html).toContain(COPY.playWordSub)
    expect(html).not.toContain('Hear it in a sentence')
    expect(html).not.toMatch(/aria-label="Play word"[^>]*disabled=""|disabled=""[^>]*aria-label="Play word"/)
  })

  it('shows her avatar and name from the child it opens with', () => {
    const html = render(NUMBERS, { name: 'Ada', grade: '4th grade', initials: 'AL' })
    expect(html).toContain('>AL<')
    expect(html).toContain('⁨Ada⁩ · ⁨4th grade⁩')
  })
})
