import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { COPY } from '../../copy'
import { ContentScreen } from './ContentScreen'

const noop = () => {}
const render = (draft: string) => renderToStaticMarkup(<ContentScreen draft={draft} onDraft={noop} />)

const valid = JSON.stringify({
  title: 'The Little Seed',
  minutes: 2,
  passage: ['Mia plants a seed.', 'She waters it.'],
  questions: [
    {
      question: 'What does Mia plant?',
      options: ['A seed', 'A tree', 'A flower', 'A bush'],
      correct_answer: 'A seed',
    },
  ],
})

describe('ContentScreen', () => {
  it('shows the Reading card, the Copy button, the JSON box and the privacy note, and nothing to fix when empty', () => {
    const html = render('')
    for (const text of [
      COPY.contentReadingHeading,
      COPY.contentReadingSub,
      COPY.contentHelperTitle,
      COPY.contentCopy,
      COPY.contentJsonLabel,
      COPY.contentJsonHint,
      COPY.contentReview,
      COPY.contentSaveNote,
      COPY.contentSave,
    ])
      expect(html).toContain(text.replace(/&/g, '&amp;').replace(/'/g, '&#x27;'))
    expect(html).toContain('Only you can manage this content.')
    expect(html).not.toContain('safeguard')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Save passage/)
  })

  it('L18: a valid passage shows the status line and a preview with the right choice marked, and Save is enabled', () => {
    const html = render(valid)
    expect(html).toContain('Valid JSON · 1 passage · 1 question')
    expect(html).toContain('The Little Seed')
    expect(html).toContain('2 minutes to read · 2 paragraphs')
    expect(html).toContain('What does Mia plant?')
    expect(html).toMatch(/content-right[^>]*>A seed<span> · Right answer/)
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Save passage/)
  })

  it('L19: a passage that fails the checks lists what to fix in plain words, shows no preview, and Save is disabled', () => {
    const bad = valid.replace('"correct_answer":"A seed"', '"correct_answer":"A bird"')
    const html = render(bad)
    expect(html).toContain('A few things to fix before saving:')
    expect(html).toContain('Question 1&#x27;s &quot;correct_answer&quot; isn&#x27;t one of its options.')
    expect(html).not.toContain('content-preview')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Save passage/)
  })

  it('text that is not JSON says so in plain words', () => {
    expect(render('{ "title": ')).toContain('isn&#x27;t valid JSON')
  })
})
