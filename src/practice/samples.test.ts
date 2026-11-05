import { describe, expect, it } from 'vitest'
import { SPELLING_COUNT, SPELLING_WORDS } from './samples'

describe('the Spelling samples (docs/DESIGN-PRACTICE.md §15)', () => {
  it('are the 8 words in order', () => {
    expect(SPELLING_COUNT).toBe(8)
    expect(SPELLING_WORDS.map((w) => w.word)).toEqual([
      'friend',
      'because',
      'said',
      'again',
      'people',
      'there',
      'could',
      'where',
    ])
  })

  it('give each word four different choices', () => {
    for (const w of SPELLING_WORDS) {
      expect(w.choices).toHaveLength(4)
      expect(new Set(w.choices).size).toBe(4)
    }
  })

  it('point the answer at the word itself', () => {
    for (const w of SPELLING_WORDS) {
      expect(w.answer).toBeGreaterThanOrEqual(0)
      expect(w.answer).toBeLessThanOrEqual(3)
      expect(w.choices[w.answer]).toBe(w.word)
    }
  })

  it('put the word in its sentence', () => {
    for (const w of SPELLING_WORDS) expect(w.sentence.toLowerCase()).toContain(w.word)
  })
})
