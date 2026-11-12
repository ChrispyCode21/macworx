import { wordAdvice } from '../engine'
import type { Lookup, WordAdvice, WordEntry } from '../engine'

/** What the dictionary check says about one word in the box, and whether the parent has added the offered spelling. */
export interface WordAdviceItem {
  word: string
  advice: Exclude<WordAdvice, { kind: 'none' }>
  /** The offered other spelling, once the parent has added it. */
  added: boolean
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/** Added other spellings are kept per word, ignoring capitals: two words are the same word that way (SPEC §6.11). */
export const acceptedKey = (word: string) => word.toLowerCase()

/**
 * The advice for the words in the box, one line per word as typed ("Mia" and "mia" are looked up apart, since the
 * dictionaries tell them apart). `asked` remembers each answer so typing does not look every word up again.
 */
export function adviceItems(
  entries: WordEntry[],
  us: Lookup,
  uk: Lookup,
  asked: Map<string, WordAdvice>,
  accepted: Record<string, string>,
): WordAdviceItem[] {
  const items: WordAdviceItem[] = []
  const seen = new Set<string>()
  for (const entry of entries) {
    if (seen.has(entry.word)) continue
    seen.add(entry.word)
    let said = asked.get(entry.word)
    if (!said) {
      said = wordAdvice(entry.word, us, uk)
      asked.set(entry.word, said)
    }
    if (said.kind === 'none') continue
    // An alternate already on the line counts as added; nothing is offered for it.
    if (said.kind === 'only' && said.other && entry.alternates.some((a) => same(a, said.other!))) continue
    items.push({ word: entry.word, advice: said, added: Object.hasOwn(accepted, acceptedKey(entry.word)) })
  }
  return items
}

/** The entries with the other spellings the parent added put on their words. */
export function withAlternates(entries: WordEntry[], accepted: Record<string, string>): WordEntry[] {
  return entries.map((entry) => {
    // Own properties only: a word like "constructor" is not an added spelling.
    const key = acceptedKey(entry.word)
    const other = Object.hasOwn(accepted, key) ? accepted[key] : undefined
    return other && !entry.alternates.some((a) => same(a, other))
      ? { ...entry, alternates: [...entry.alternates, other] }
      : entry
  })
}
