import { describe, expect, it } from 'vitest'
import type { Lookup, WordAdvice, WordEntry } from '../engine'
import { adviceItems, withAlternates } from './wordAdvice'

const entry = (word: string, alternates: string[] = []): WordEntry => ({ word, sentence: '', alternates })
const dict = (words: string[], suggestions: Record<string, string[]> = {}): Lookup => ({
  correct: (w) => words.includes(w),
  suggest: (w) => suggestions[w] ?? [],
})
const us = dict(['Mia', 'color'])
const uk = dict(['Mia', 'colour'], { color: ['colour'] })
const usSees = dict(['Mia', 'color'], { colour: ['color'] })

describe('adviceItems', () => {
  it('E23: "Mia" and "mia" are advised apart, whichever comes first, and a repeated word once', () => {
    const asked = new Map<string, WordAdvice>()
    expect(adviceItems([entry('mia')], us, uk, asked, {}).map((i) => i.word)).toEqual(['mia'])
    // Corrected to "Mia": the earlier answer for "mia" is not reused for it.
    expect(adviceItems([entry('Mia')], us, uk, asked, {})).toEqual([])
    expect(
      adviceItems([entry('Mia'), entry('mia'), entry('mia')], us, uk, asked, {}).map((i) => i.word),
    ).toEqual(['mia'])
  })

  it('offers the other spelling, marks it added, and offers nothing for one already on the line', () => {
    const asked = new Map<string, WordAdvice>()
    const one = adviceItems([entry('colour')], usSees, uk, asked, {})
    expect(one[0]).toMatchObject({ word: 'colour', added: false, advice: { kind: 'only', other: 'color' } })
    // An added spelling belongs to the word whatever its capitals.
    expect(adviceItems([entry('Colour')], usSees, uk, asked, { colour: 'color' })[0]!.added).toBe(true)
    expect(adviceItems([entry('colour')], usSees, uk, asked, { colour: 'color' })[0]!.added).toBe(true)
    expect(adviceItems([entry('colour', ['color'])], usSees, uk, asked, {})).toEqual([])
  })
})

describe('withAlternates', () => {
  it('puts an added spelling on its word, once, and leaves the others alone', () => {
    const entries = [entry('colour'), entry('grey', ['gray']), entry('other')]
    expect(withAlternates(entries, { colour: 'color', grey: 'gray' })).toEqual([
      entry('colour', ['color']),
      entry('grey', ['gray']),
      entry('other'),
    ])
  })
})
