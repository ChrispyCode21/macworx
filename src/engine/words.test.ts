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

describe('words from other sources', () => {
  it('a mark must follow a letter, and invisible marks are refused, so she can always type the word back', () => {
    expect(problems('\u0301abc')).toHaveLength(1)
    expect(problems('a\uFE0F')).toHaveLength(1)
    expect(problems('a\u200Bb')).toHaveLength(1)
    expect(problems('cafe\u0301')).toEqual([])
  })

  it('counts length after NFC, so a pasted accent is one character however it is written', () => {
    expect(problems('e\u0301'.repeat(40))).toEqual([])
    expect(problems('e\u0301'.repeat(41))).toHaveLength(1)
    expect(problems('their', { sentence: 'e\u0301'.repeat(200) })).toEqual([])
  })

  it('a modifier-letter apostrophe is a word she can type back with a curly one', () => {
    expect(problems('don\u02bct')).toEqual([])
  })

  it('refuses an entry that is not shaped like one, instead of throwing', () => {
    expect(problems('colour', { alternates: 'color' as unknown as string[] })).toEqual([
      'The alternates have to be a list of text.',
    ])
    for (const bad of [null, undefined, 5, 'word', { word: 5 }, { word: null }, { word: 'a', sentence: 3 }])
      expect(checkWord(bad).ok).toBe(false)
    expect(checkWord({ word: 'a', sentence: null }).ok).toBe(true)
  })

  it('E20: a pasted line with nothing before the colon is a missing word, and a colon inside a sentence stays in it', () => {
    const [empty] = parseWords(':x')
    expect(checkWord(empty)).toEqual({ ok: false, problems: ['The word is missing.'] })
    expect(parseWords('their: Note: they ate.')).toEqual([
      { word: 'their', sentence: 'Note: they ate.', alternates: [] },
    ])
  })

  it('E18: the refusal of r2d2 is a sentence a parent can act on', () => {
    expect(problems('r2d2')).toEqual(['The word "r2d2" can only have letters, apostrophes and hyphens.'])
  })
})
