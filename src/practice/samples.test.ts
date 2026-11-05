import { describe, expect, it } from 'vitest'
import { READING_COUNT, READING_PASSAGE, SPELLING_COUNT, SPELLING_WORDS } from './samples'

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

describe('the Reading sample (docs/DESIGN-PRACTICE.md §15)', () => {
  it('is one passage of 3 paragraphs with its title, kind and minutes', () => {
    expect(READING_PASSAGE.title).toBe('Lorem ipsum dolor')
    expect(READING_PASSAGE.kind).toBe('Informational text')
    expect(READING_PASSAGE.minutes).toBe(2)
    expect(READING_PASSAGE.paragraphs).toHaveLength(3)
    expect(READING_PASSAGE.hint).toBe('Lorem ipsum dolor sit amet.')
  })

  it('has 2 questions of 3 different choices, answered B then A', () => {
    expect(READING_COUNT).toBe(2)
    for (const q of READING_PASSAGE.questions) {
      expect(q.choices).toHaveLength(3)
      expect(new Set(q.choices).size).toBe(3)
      expect(q.answer).toBeGreaterThanOrEqual(0)
      expect(q.answer).toBeLessThanOrEqual(2)
    }
    expect(READING_PASSAGE.questions.map((q) => q.answer)).toEqual([1, 0])
    expect(READING_PASSAGE.questions.map((q) => q.skill)).toEqual(['Find a detail', 'Think it through'])
  })
})
