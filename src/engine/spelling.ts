// Scoring a spelling assignment (SPEC §6.3): what she typed against each word and its accepted alternates.

/**
 * A word or her typing in the form it is compared in: accents in one written form, spaces trimmed, capitals
 * ignored, and a curly apostrophe (what an iPad types) read as a straight one.
 */
export const normalizeTyped = (text: string): string =>
  text.normalize('NFC').trim().replace(/[’‘ʼ]/g, "'").toLowerCase()

/** Whether her typing is the word or one of its alternates. */
export function checkSpelling(typed: string, word: string, alternates: readonly string[] = []): boolean {
  const mine = normalizeTyped(typed)
  return [word, ...alternates].some((accepted) => normalizeTyped(accepted) === mine)
}

/** How many words she got right: her typing at each index against that word. */
export function scoreSpelling(
  words: readonly { word: string; alternates?: readonly string[] }[],
  typed: readonly string[],
): number {
  if (words.length === 0 || typed.length !== words.length)
    throw new RangeError(`Invalid spelling result: ${typed.length} answers for ${words.length} words`)
  if (typed.some((t) => typeof t !== 'string'))
    throw new RangeError('Invalid spelling result: an answer is not text')
  return words.filter((w, i) => checkSpelling(typed[i]!, w.word, w.alternates)).length
}
