import { describe, expect, it } from 'vitest'
import { alternatesText, filterWords, parseAlternates } from './wordList'
import type { WordItem } from './wordList'

const word = (id: number, w: string, sentence = '', alternates: string[] = []): WordItem => ({
  id,
  word: w,
  sentence,
  alternates,
  grade: null,
})
const words = [
  word(1, 'because'),
  word(2, 'favourite', 'My favourite colour.', ['favorite']),
  word(3, 'Friend'),
  word(4, 'café'),
]

describe('filterWords', () => {
  it('matches the word, an alternate and the sentence, ignoring capitals', () => {
    expect(filterWords(words, 'FRIEND').map((w) => w.id)).toEqual([3])
    expect(filterWords(words, 'favor').map((w) => w.id)).toEqual([2])
    expect(filterWords(words, 'colour').map((w) => w.id)).toEqual([2])
    expect(filterWords(words, 'ec').map((w) => w.id)).toEqual([1])
  })

  it('an empty search, or spaces, shows every word, and a search with no match shows none', () => {
    expect(filterWords(words, '')).toHaveLength(4)
    expect(filterWords(words, '   ')).toHaveLength(4)
    expect(filterWords(words, 'zzz')).toEqual([])
  })

  it('reads accents and apostrophes the way her typing does', () => {
    expect(filterWords(words, 'café').map((w) => w.id)).toEqual([4])
    expect(filterWords([word(5, "don't")], 'don’t')).toHaveLength(1)
  })
})

describe('the alternates box', () => {
  it('shows alternates separated by commas and reads them back, leaving blanks out', () => {
    expect(alternatesText(['favorite', 'favourit'])).toBe('favorite, favourit')
    expect(parseAlternates(' favorite ,, favourit , ')).toEqual(['favorite', 'favourit'])
    expect(parseAlternates('')).toEqual([])
  })
})
