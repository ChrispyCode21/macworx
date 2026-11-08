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

/** One Reading question: three choices, one right (docs/DESIGN-PRACTICE.md §15). */
export interface ReadingQuestion {
  skill: string
  question: string
  choices: readonly [string, string, string]
  /** The index of the right choice in `choices`. */
  answer: number
}

/** Reading practice is this one passage and its questions, placeholder text (SPEC §5.5). Nothing about it is stored or sent. */
export const READING_PASSAGE = {
  kind: 'Informational text',
  minutes: 2,
  title: 'Lorem ipsum dolor',
  paragraphs: [
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
    'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.',
  ],
  hint: 'Lorem ipsum dolor sit amet.',
  questions: [
    {
      skill: 'Find a detail',
      question: 'Lorem ipsum dolor sit amet?',
      choices: ['Consectetur adipiscing elit.', 'Sed do eiusmod tempor.', 'Ut labore et dolore.'],
      answer: 1,
    },
    {
      skill: 'Think it through',
      question: 'Ut enim ad minim veniam?',
      choices: ['Quis nostrud exercitation.', 'Ullamco laboris nisi.', 'Ut aliquip ex ea commodo.'],
      answer: 0,
    },
  ] as readonly ReadingQuestion[],
}

export const READING_COUNT = READING_PASSAGE.questions.length

/** The letter on each choice's marker (docs/DESIGN-PRACTICE.md §7.3). */
export const LETTERS = ['A', 'B', 'C', 'D']
