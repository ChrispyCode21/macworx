import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { COPY } from '../../copy'
import type { ReadingPassage } from '../../sync/reading'
import { ReadingAssignment } from './ReadingAssignment'

// There is no DOM here, so these check the screen as it opens. The pairing, the check and the retry are in
// src/sync/reading.test.ts, and the whole flow is in e2e/reading-paid.spec.ts.
const passage: ReadingPassage = {
  id: 1,
  title: 'The Lighthouse',
  genre: '',
  minutes: 3,
  hint: '',
  paragraphs: ['First paragraph.', 'Second paragraph.'],
  image: 'lighthouse.jpg',
  questions: [{ id: 1, text: 'Where?', choices: [{ id: 10, text: 'On a rock' }] }],
}
const render = (p: ReadingPassage) =>
  renderToStaticMarkup(<ReadingAssignment attempt={4} passage={p} onBack={() => {}} onDone={() => {}} />)

describe('ReadingAssignment passage', () => {
  it('shows the title, the minutes and the paragraphs, and leaves out an empty genre and hint', () => {
    const html = render(passage)
    expect(html).toContain('The Lighthouse')
    expect(html).toContain('3 min read')
    expect(html).toContain('First paragraph.')
    expect(html).toContain('Second paragraph.')
    expect(html).not.toContain(COPY.readingGuideTitle)
    expect(html).toContain('practice-reading-solo')
  })

  it('shows no picture until pictures arrive, even when the passage names one', () => {
    expect(render(passage)).not.toContain('<img')
  })

  it('shows the genre and the hint when the passage has them', () => {
    const html = render({ ...passage, genre: 'Story', hint: 'Look for the setting.' })
    expect(html).toContain('Story · 3 min read')
    expect(html).toContain('Look for the setting.')
  })

  it('has Next and no question, choice or right answer before the questions open', () => {
    const html = render(passage)
    expect(html).toContain('>Next<')
    expect(html).not.toContain('role="radio"')
    expect(html).not.toContain('On a rock')
    expect(html).not.toContain(COPY.checkAnswers)
  })
})
