import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { COPY } from '../../copy'
import { READING_COUNT, READING_PASSAGE } from '../../practice/samples'
import type { HomeNumbers, PracticeChild } from '../../sync/projection'
import { ReadingPractice } from './ReadingPractice'

// There is no DOM here, so these check the screen as it opens. Reading, answering and checking are in e2e/reading.spec.ts.
const NUMBERS: HomeNumbers = { balance: 40, completed: 2, streak: 3, latestGrade: null }
const CHILD: PracticeChild = { name: 'Ada', grade: '4th grade', initials: 'AL' }
const render = (numbers?: HomeNumbers, child?: PracticeChild | null) =>
  renderToStaticMarkup(<ReadingPractice numbers={numbers} child={child} onBack={() => {}} />)

describe('ReadingPractice', () => {
  it('opens on the passage with the crumb, the title, step 1 of 2 and the note', () => {
    const html = render(NUMBERS)
    expect(html).toContain('Practice  /  Reading')
    expect(html).toContain(COPY.readingTitle)
    expect(html).toContain('Step 1 of 2 · Read')
    expect(html).toContain('aria-valuenow="1"')
    expect(html).toContain('aria-valuemax="2"')
    // React escapes the apostrophe in the markup.
    expect(html).toContain(COPY.readingNote(READING_COUNT).replaceAll("'", '&#x27;'))
  })

  it('shows the passage and the guidance, with no picture', () => {
    const html = render()
    expect(html).toContain('Informational text · 2 min read')
    expect(html).toContain('>Lorem ipsum dolor<')
    for (const p of READING_PASSAGE.paragraphs) expect(html).toContain(p)
    expect(html).toContain(COPY.readingGuideTitle)
    expect(html).toContain(READING_PASSAGE.hint)
    expect(html).not.toContain('<img')
  })

  it('names the scrollable passage by its title', () => {
    const html = render()
    const id = /<h2 id="([^"]+)"/.exec(html)?.[1]
    expect(id).toBeTruthy()
    expect(html).toContain(`aria-labelledby="${id}"`)
    expect(html).toContain('tabindex="0"')
  })

  it('has Next, and no question or check on the passage', () => {
    const html = render()
    expect(html).toContain('>Next<')
    expect(html).not.toContain('role="radio"')
    expect(html).not.toContain(COPY.checkAnswers)
  })

  it('takes the avatar, name and numbers from its props', () => {
    const html = render(NUMBERS, CHILD)
    expect(html).toContain('40 Macaronis')
    expect(html).toContain('AL')
    expect(html).toContain('Ada')
  })
})
