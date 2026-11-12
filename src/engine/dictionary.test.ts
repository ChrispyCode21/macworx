import { describe, expect, it } from 'vitest'
import { wordAdvice, type Lookup } from './dictionary'

/** A dictionary of a few words, with canned suggestions. */
const dict = (words: string[], suggestions: Record<string, string[]> = {}): Lookup => ({
  correct: (w) => words.includes(w),
  suggest: (w) => suggestions[w] ?? [],
})

describe('wordAdvice', () => {
  it('E21: a word in one dictionary is offered the other spelling, a word in both says nothing, a word in neither is a warning', () => {
    const us = dict(['color', 'because'], { colour: ['color'] })
    const uk = dict(['colour', 'because'], { color: ['colour'] })
    expect(wordAdvice('colour', us, uk)).toEqual({ kind: 'only', from: 'UK', other: 'color' })
    expect(wordAdvice('color', us, uk)).toEqual({ kind: 'only', from: 'US', other: 'colour' })
    expect(wordAdvice('because', us, uk)).toEqual({ kind: 'none' })
    expect(wordAdvice('xqzt', us, uk)).toEqual({ kind: 'neither' })
  })

  it('E22: the offer is the first suggestion only the other dictionary has, within two letters', () => {
    const us = dict(['trey', 'Grey', 'gray', 'organist', 'organism', 'organize'], {
      grey: ['trey', 'Grey', 'gray'],
      organise: ['organist', 'organism', 'organize'],
      tyre: ['pyre', 'tare', 'type'],
      theatre: ['ruminate'],
    })
    const uk = dict(['grey', 'Grey', 'trey', 'organise', 'organist', 'organism', 'tyre', 'theatre'])
    // "trey" and "Grey" are in both; "gray" is US only.
    expect(wordAdvice('grey', us, uk)).toEqual({ kind: 'only', from: 'UK', other: 'gray' })
    expect(wordAdvice('organise', us, uk)).toEqual({ kind: 'only', from: 'UK', other: 'organize' })
    // Nothing to offer when no suggestion qualifies, or the only one is too far away.
    expect(wordAdvice('tyre', us, uk)).toEqual({ kind: 'only', from: 'UK', other: null })
    expect(wordAdvice('theatre', us, uk)).toEqual({ kind: 'only', from: 'UK', other: null })
  })

  it('E23: a word is found as typed or in lowercase, and a word with hyphens or spaces when each part is', () => {
    const both = dict(['Mia', 'well', 'known', "don't"])
    expect(wordAdvice('Mia', both, both)).toEqual({ kind: 'none' })
    expect(wordAdvice('mia', both, both)).toEqual({ kind: 'neither' })
    expect(wordAdvice('MIA', dict(['mia']), dict(['mia']))).toEqual({ kind: 'none' })
    expect(wordAdvice('well-known', both, both)).toEqual({ kind: 'none' })
    expect(wordAdvice('well-knownn', both, both)).toEqual({ kind: 'neither' })
    expect(wordAdvice('don’t', both, both)).toEqual({ kind: 'none' })
  })
})
