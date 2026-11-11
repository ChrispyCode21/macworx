/** One word she hears and types, as the Worker hands it out (SPEC §5.7, §8): the sample uses the same shape. */
export interface SpellingWord {
  id: number
  word: string
  sentence: string
  alternates: readonly string[]
}

/** The Spelling sample is these 8 words, in this order (SPEC §5.5). Nothing about them is stored or sent. */
export const SPELLING_WORDS: readonly SpellingWord[] = [
  { id: 1, word: 'friend', sentence: 'My friend sits next to me.', alternates: [] },
  { id: 2, word: 'because', sentence: 'I smiled because it was sunny.', alternates: [] },
  { id: 3, word: 'said', sentence: 'Mom said it was time for lunch.', alternates: [] },
  { id: 4, word: 'again', sentence: "Let's play that game again.", alternates: [] },
  { id: 5, word: 'people', sentence: 'Many people came to the park.', alternates: [] },
  { id: 6, word: 'there', sentence: 'The cat is over there.', alternates: [] },
  { id: 7, word: 'could', sentence: 'I could see the moon.', alternates: [] },
  { id: 8, word: 'where', sentence: 'Where did you put the ball?', alternates: [] },
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
