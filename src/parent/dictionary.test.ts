import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import { wordAdvice } from '../engine'

// The real US and UK dictionaries, read from the packages' files (the browser fetches the same files).
const nspell = createRequire(import.meta.url)('nspell') as (aff: string, dic: string) => never
const load = (name: string) =>
  nspell(
    readFileSync(`node_modules/${name}/index.aff`, 'utf8'),
    readFileSync(`node_modules/${name}/index.dic`, 'utf8'),
  ) as { correct(w: string): boolean; suggest(w: string): string[] }
const us = load('dictionary-en')
const uk = load('dictionary-en-gb')

describe('the real dictionaries', () => {
  it('E21: colour, color, because and xqzt', () => {
    expect(wordAdvice('colour', us, uk)).toEqual({ kind: 'only', from: 'UK', other: 'color' })
    expect(wordAdvice('color', us, uk)).toEqual({ kind: 'only', from: 'US', other: 'colour' })
    expect(wordAdvice('because', us, uk)).toEqual({ kind: 'none' })
    expect(wordAdvice('xqzt', us, uk)).toEqual({ kind: 'neither' })
  })

  it('E22: grey is offered gray and organise is offered organize', () => {
    expect(wordAdvice('grey', us, uk)).toEqual({ kind: 'only', from: 'UK', other: 'gray' })
    expect(wordAdvice('organise', us, uk)).toEqual({ kind: 'only', from: 'UK', other: 'organize' })
  })

  it('E23: Mia and well-known are found, mia is not', () => {
    expect(wordAdvice('Mia', us, uk)).toEqual({ kind: 'none' })
    expect(wordAdvice('well-known', us, uk)).toEqual({ kind: 'none' })
    expect(wordAdvice('mia', us, uk)).toEqual({ kind: 'neither' })
  })
})
