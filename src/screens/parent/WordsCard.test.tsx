import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { COPY } from '../../copy'
import { WordsCard } from './WordsCard'
import type { WordsForm } from './useWordsForm'

const form = (over: Partial<WordsForm> = {}): WordsForm => ({
  draft: '',
  setDraft: () => {},
  count: 0,
  problems: [],
  saving: false,
  note: null,
  save: async () => {},
  ...over,
})
const render = (over: Partial<WordsForm> = {}) => renderToStaticMarkup(<WordsCard form={form(over)} />)
const escaped = (text: string) => text.replace(/&/g, '&amp;').replace(/'/g, '&#x27;').replace(/"/g, '&quot;')

describe('WordsCard', () => {
  it('shows the Spelling card from the design, with the hint before the box and Save disabled when empty', () => {
    const html = render()
    for (const text of [
      COPY.wordsHeading,
      COPY.wordsSub,
      COPY.wordsLabel,
      COPY.wordsHint,
      COPY.wordsBlankLines,
      COPY.wordsUse,
      COPY.wordsSave,
    ])
      expect(html).toContain(escaped(text))
    expect(html).toContain('0 words')
    expect(html.indexOf(COPY.wordsHint)).toBeLessThan(html.indexOf('<textarea'))
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Save word list/)
    expect(html).toContain('spellCheck="false"')
    expect(html).not.toContain('safeguard')
  })

  it('counts the words, and enables Save when there are some and nothing to fix', () => {
    const html = render({ draft: 'because\nfriend', count: 2 })
    expect(html).toContain('2 words')
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Save word list/)
    expect(render({ count: 1 })).toContain('1 word<')
  })

  it('lists what to fix in plain words, and keeps Save off', () => {
    const html = render({
      count: 2,
      problems: ['The word "ice cream" can only have letters, apostrophes and hyphens.'],
    })
    expect(html).toContain('A few things to fix before saving:')
    expect(html).toContain('ice cream')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Save word list/)
    expect(html).not.toMatch(/<p[^>]*>(?:(?!<\/p>)[\s\S])*<ul/)
  })

  it('says how many words were added and how many were already there, and shows Saving… while one is sent', () => {
    expect(COPY.wordsAdded(3, 0)).toBe('Added 3 words.')
    expect(COPY.wordsAdded(1, 1)).toBe('Added 1 word. 1 was already there.')
    expect(COPY.wordsAdded(0, 2)).toBe('Added 0 words. 2 were already there.')
    expect(render({ note: { tone: 'info', text: COPY.wordsAdded(2, 1) } })).toContain('Added 2 words.')
    expect(render({ count: 2, saving: true })).toMatch(/<button[^>]*disabled=""[^>]*>Saving…/)
  })
})
