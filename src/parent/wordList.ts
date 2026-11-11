// The word list as the Edit list dialog shows it (SPEC §5.3): what a word looks like, and the search.
import { normalizeTyped } from '../engine'

export interface WordItem {
  id: number
  word: string
  sentence: string
  alternates: string[]
  grade: number | null
}

/** The words that match a search: its text is in the word, an alternate or the sentence, ignoring capitals. */
export function filterWords(words: readonly WordItem[], query: string): WordItem[] {
  const q = normalizeTyped(query)
  if (q === '') return [...words]
  return words.filter((w) =>
    [w.word, w.sentence, ...w.alternates].some((text) => normalizeTyped(text).includes(q)),
  )
}

/** The words alphabetical, ignoring capitals, as the Worker lists them (ties by id). */
export function sortWords(words: readonly WordItem[]): WordItem[] {
  const collator = new Intl.Collator('en', { sensitivity: 'accent' })
  return [...words].sort((a, b) => collator.compare(a.word, b.word) || a.id - b.id)
}

/** The alternates as one box shows them, separated by commas. */
export const alternatesText = (alternates: readonly string[]): string => alternates.join(', ')

/** The alternates from that box: separated by commas, blanks left out. */
export const parseAlternates = (text: string): string[] =>
  text
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
