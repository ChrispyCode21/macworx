/** One Spelling sample: the word she hears, a sentence with it, and four spellings (docs/DESIGN-PRACTICE.md §15). */
export interface SpellingWord {
  word: string
  sentence: string
  choices: readonly [string, string, string, string]
  /** The index of the right spelling in `choices`. */
  answer: number
}

/** Spelling practice is these 8 words, in this order (SPEC §5.5). Nothing about them is stored or sent. */
export const SPELLING_WORDS: readonly SpellingWord[] = [
  {
    word: 'friend',
    sentence: 'My friend sits next to me.',
    choices: ['frend', 'freind', 'friend', 'frind'],
    answer: 2,
  },
  {
    word: 'because',
    sentence: 'I smiled because it was sunny.',
    choices: ['because', 'becuase', 'becos', 'beacause'],
    answer: 0,
  },
  {
    word: 'said',
    sentence: 'Mom said it was time for lunch.',
    choices: ['sed', 'siad', 'saide', 'said'],
    answer: 3,
  },
  {
    word: 'again',
    sentence: "Let's play that game again.",
    choices: ['agin', 'again', 'agian', 'egain'],
    answer: 1,
  },
  {
    word: 'people',
    sentence: 'Many people came to the park.',
    choices: ['peple', 'poeple', 'people', 'peeple'],
    answer: 2,
  },
  {
    word: 'there',
    sentence: 'The cat is over there.',
    choices: ['there', 'thare', 'ther', 'theer'],
    answer: 0,
  },
  {
    word: 'could',
    sentence: 'I could see the moon.',
    choices: ['cood', 'culd', 'coud', 'could'],
    answer: 3,
  },
  {
    word: 'where',
    sentence: 'Where did you put the ball?',
    choices: ['whare', 'where', 'wher', 'wheer'],
    answer: 1,
  },
]

export const SPELLING_COUNT = SPELLING_WORDS.length
