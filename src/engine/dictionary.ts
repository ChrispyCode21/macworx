/** A dictionary the check asks: whether a word is in it, and its best suggestions for a word that isn't. */
export interface Lookup {
  correct(word: string): boolean
  suggest(word: string): string[]
}

/** What the check says about one word (SPEC §6.11). It is advice only. */
export type WordAdvice =
  { kind: 'none' } | { kind: 'neither' } | { kind: 'only'; from: 'US' | 'UK'; other: string | null }

/** How many of the other dictionary's suggestions are looked at, and how far from the word one may be. */
const LOOKED_AT = 5
const MOST_LETTERS_AWAY = 2

/** Curly apostrophes read as the straight one, as her typing does (§6.3). */
const straight = (text: string) => text.replace(/[’‘ʼ]/g, "'")

/** Found as typed or in lowercase; a word with spaces or hyphens is found when each part is. */
function found(dictionary: Lookup, word: string): boolean {
  const parts = word.split(/[\s-]+/).filter(Boolean)
  return (
    parts.length > 0 &&
    parts.every((part) => dictionary.correct(part) || dictionary.correct(part.toLowerCase()))
  )
}

/** The number of one-letter changes (add, drop, swap for another) between two words. */
function lettersAway(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(row[j]! + 1, next[j - 1]! + 1, row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))
    row = next
  }
  return row[b.length]!
}

/**
 * Looks one word up in the US and UK English dictionaries. A word in both says nothing. A word in neither gets a
 * warning. A word in only one is offered with the other spelling: the first of the other dictionary's best
 * suggestions that is in it and not in the one that found the word, and is within two letters of the word.
 */
export function wordAdvice(word: string, us: Lookup, uk: Lookup): WordAdvice {
  const typed = straight(word).trim()
  const inUs = found(us, typed)
  const inUk = found(uk, typed)
  if (inUs && inUk) return { kind: 'none' }
  if (!inUs && !inUk) return { kind: 'neither' }
  const [from, has, other] = inUs ? (['US', us, uk] as const) : (['UK', uk, us] as const)
  const suggestion = other
    .suggest(typed)
    .slice(0, LOOKED_AT)
    .find(
      (s) =>
        found(other, s) &&
        !found(has, s) &&
        lettersAway(s.toLowerCase(), typed.toLowerCase()) <= MOST_LETTERS_AWAY,
    )
  return { kind: 'only', from, other: suggestion ?? null }
}
