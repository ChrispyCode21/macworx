// The words a parent adds (SPEC §5.3, §6.11, §7.E).
import { describe, expect, it } from 'vitest'
import { checkWord, parseWords } from './words'

const problems = (word: string, extra: { sentence?: string; alternates?: string[] } = {}) => {
  const result = checkWord({ word, ...extra })
  return result.ok ? [] : result.problems
}

describe('parseWords', () => {
  it('E16: splits lines and commas, keeps a colon line whole, reads alternates, and drops blanks', () => {
    const text = 'because, friend\n\nfavourite/favorite\r\ntheir: They ate their dinner, then left.\n   \n'
    expect(parseWords(text)).toEqual([
      { word: 'because', sentence: '', alternates: [] },
      { word: 'friend', sentence: '', alternates: [] },
      { word: 'favourite', sentence: '', alternates: ['favorite'] },
      { word: 'their', sentence: 'They ate their dinner, then left.', alternates: [] },
    ])
  })

  it('reads a single word, a comma list with stray commas, and an alternate with a sentence', () => {
    expect(parseWords('one')).toEqual([{ word: 'one', sentence: '', alternates: [] }])
    expect(parseWords(',a,, b ,').map((e) => e.word)).toEqual(['a', 'b'])
    expect(parseWords('colour/color: A bright colour.')).toEqual([
      { word: 'colour', sentence: 'A bright colour.', alternates: ['color'] },
    ])
    expect(parseWords('their:')).toEqual([{ word: 'their', sentence: '', alternates: [] }])
    expect(parseWords('')).toEqual([])
  })
})

describe('checkWord', () => {
  it('E18: accepts mother-in-law, don’t and a word with accents', () => {
    for (const word of ['mother-in-law', "don't", 'don’t', 'café', 'naïve'])
      expect(checkWord({ word }).ok, word).toBe(true)
  })

  it('E18: refuses a space, a digit, an empty word, a word with no letter, and 41 characters, in plain words', () => {
    expect(problems('ice cream')).toEqual([
      'The word "ice cream" can only have letters, apostrophes and hyphens.',
    ])
    expect(problems('r2d2')).toHaveLength(1)
    expect(problems('')).toEqual(['The word is missing.'])
    expect(problems("'-'")).toEqual(['The word "\'-\'" needs at least one letter.'])
    expect(problems('a'.repeat(40))).toEqual([])
    expect(problems('a'.repeat(41))).toEqual([
      'The word "' + 'a'.repeat(41) + '" is longer than 40 characters.',
    ])
  })

  it('tidies the entry: trimmed, an alternate that repeats the word or another is dropped, an empty sentence is none', () => {
    const result = checkWord({
      word: ' colour ',
      sentence: '  ',
      alternates: ['Colour', 'color', ' color ', ''],
    })
    expect(result).toEqual({ ok: true, entry: { word: 'colour', sentence: '', alternates: ['color'] } })
  })

  it('refuses a bad alternate and a sentence over 200 characters, naming each', () => {
    expect(problems('colour', { alternates: ['co lor'] })).toEqual([
      'The alternate "co lor" can only have letters, apostrophes and hyphens.',
    ])
    expect(problems('their', { sentence: 'x'.repeat(200) })).toEqual([])
    expect(problems('their', { sentence: 'x'.repeat(201) })).toEqual([
      'The sentence for "their" is longer than 200 characters.',
    ])
  })
})
