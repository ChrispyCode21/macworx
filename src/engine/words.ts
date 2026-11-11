// The words a parent adds for spelling (SPEC §5.3, §6.11): a pasted list split into entries, and the rules for one.
import { SPELLING } from './config'
import { normalizeTyped } from './spelling'

export interface WordEntry {
  word: string
  /** Said after the word; '' for none. */
  sentence: string
  /** Other spellings that are also right, such as the US one of a UK word. */
  alternates: string[]
}

export type WordCheck = { ok: true; entry: WordEntry } | { ok: false; problems: string[] }

/** `favourite/favorite` as a word and its alternates; the first piece is the word. */
function entryOf(head: string, sentence: string): WordEntry {
  const [word = '', ...alternates] = head.split('/').map((part) => part.trim())
  return { word, sentence: sentence.trim(), alternates: alternates.filter(Boolean) }
}

/**
 * A pasted list as entries, not yet checked. One entry a line or comma-separated; a line with a colon is one entry
 * (`their: They ate their dinner.`), and commas split only a line without one. Blank lines and empty pieces are left out.
 */
export function parseWords(text: string): WordEntry[] {
  const entries: WordEntry[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (line === '') continue
    const colon = line.indexOf(':')
    if (colon >= 0) {
      entries.push(entryOf(line.slice(0, colon), line.slice(colon + 1)))
      continue
    }
    for (const piece of line.split(',')) if (piece.trim() !== '') entries.push(entryOf(piece, ''))
  }
  return entries
}

const LETTERS = /^[\p{L}\p{M}'’-]+$/u
const HAS_LETTER = /\p{L}/u
const length = (text: string) => Array.from(text).length

/** The problem with a word or an alternate, as a sentence, or null when it is fine. */
function wordProblem(word: string, what: string): string | null {
  if (word === '') return `${what} is missing.`
  if (length(word) > SPELLING.wordLength)
    return `${what} "${word}" is longer than ${SPELLING.wordLength} characters.`
  if (!LETTERS.test(word)) return `${what} "${word}" can only have letters, apostrophes and hyphens.`
  if (!HAS_LETTER.test(word)) return `${what} "${word}" needs at least one letter.`
  return null
}

/**
 * Checks one entry against the rules of §6.11, and tidies it: trimmed, and alternates that repeat the word or each
 * other dropped.
 */
export function checkWord(entry: {
  word: string
  sentence?: string
  alternates?: readonly string[]
}): WordCheck {
  const word = entry.word.trim()
  const sentence = (entry.sentence ?? '').trim()
  const problems: string[] = []
  const first = wordProblem(word, 'The word')
  if (first) problems.push(first)

  const alternates: string[] = []
  const seen = new Set([normalizeTyped(word)])
  for (const raw of entry.alternates ?? []) {
    const alternate = raw.trim()
    if (alternate === '') continue
    const problem = wordProblem(alternate, 'The alternate')
    if (problem) problems.push(problem)
    else if (!seen.has(normalizeTyped(alternate))) {
      seen.add(normalizeTyped(alternate))
      alternates.push(alternate)
    }
  }
  if (length(sentence) > SPELLING.sentenceLength)
    problems.push(`The sentence for "${word}" is longer than ${SPELLING.sentenceLength} characters.`)

  return problems.length > 0 ? { ok: false, problems } : { ok: true, entry: { word, sentence, alternates } }
}
