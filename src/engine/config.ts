// The one config module (CLAUDE.md): payout values, grade cutoffs, assignment shape, generator
// ranges and reward prices. Change a number here, and its SPEC.md section and §7 examples with it.

/** Macaroni payout (SPEC §6.4). */
export const PAYOUT = {
  perCorrect: 1,
  /** The base scales a result to an assignment of this many problems (SPEC §6.4). */
  baseScale: 20,
  /** Accuracy bonus: this percent of the base, rounded down. */
  accuracyBonusPercent: 20,
  /** Streak bonus per streak day, on the first finished assignment of the day only. */
  streakPerDay: 1,
  streakCap: 10,
  /** A finished assignment always pays at least this much in total. */
  minimum: 1,
} as const

/** Grade cutoffs, best first (SPEC §6.6). An assignment gets the first grade whose minimum it meets. */
export const GRADES = [
  { label: 'Excellent', minPercent: 100 },
  { label: 'Great', minPercent: 90 },
  { label: 'Good', minPercent: 80 },
  { label: 'Improving', minPercent: 0 },
] as const

export type Grade = (typeof GRADES)[number]['label']

/** Problems per assignment, by operation (SPEC §6.2). */
export const ASSIGNMENT = {
  addition: 7,
  subtraction: 7,
  multiplication: 6,
} as const

/** The most questions a reading assignment gives, whatever the passage has (SPEC §6.2). */
export const READING_QUESTIONS = 10

/** A spelling assignment's most words, and the limits on a word and its sentence (SPEC §6.2, §6.11). */
export const SPELLING = {
  words: 20,
  wordLength: 40,
  sentenceLength: 200,
  /** The most characters one typed word may have (SPEC §5.7 step 2, §8). */
  typedLength: 100,
  /** The most entries, and the most bytes of JSON, one save of the word list may carry (SPEC §8). */
  perSave: 500,
  saveBytes: 256 * 1024,
} as const

/** Problems in one assignment. */
export const ASSIGNMENT_SIZE = ASSIGNMENT.addition + ASSIGNMENT.subtraction + ASSIGNMENT.multiplication

/** The largest answer a result may carry; the Worker refuses anything above it. */
export const MAX_ANSWER = 999_999

/** Number ranges (SPEC §6.1). */
export const GENERATOR = {
  /** Addition and subtraction: both numbers share one of these digit counts, equally likely. */
  digitCounts: [3, 4, 5],
  /** Multiplication: both factors run from 0 to this. */
  factorMax: 9,
} as const

/** The levels of a mix pick (SPEC §6.1). */
export const LEVELS = ['easy', 'medium', 'hard'] as const

/** A mix has 1 to this many picks (SPEC §6.2). */
export const MAX_PICKS = 3

type Range = readonly [min: number, max: number]
interface Ranges {
  /** The first number drawn: the first addend, the larger-or-smaller subtraction number, the first factor, the divisor. */
  first: Range
  /** The second number drawn: the second addend or number, the second factor, the answer (division). */
  second: Range
}

/** Number ranges of a mix pick, by operation and level (SPEC §6.1). Both numbers are drawn evenly. */
export const RANGES = {
  addition: {
    easy: { first: [1, 9], second: [1, 9] },
    medium: { first: [10, 99], second: [10, 99] },
    hard: { first: [100, 999], second: [100, 999] },
  },
  subtraction: {
    easy: { first: [1, 9], second: [1, 9] },
    medium: { first: [10, 99], second: [10, 99] },
    hard: { first: [100, 999], second: [100, 999] },
  },
  multiplication: {
    easy: { first: [0, 5], second: [0, 5] },
    medium: { first: [0, 9], second: [0, 9] },
    hard: { first: [10, 99], second: [2, 9] },
  },
  // first is the divisor, second the answer; the dividend is their product.
  division: {
    easy: { first: [1, 5], second: [1, 5] },
    medium: { first: [1, 9], second: [1, 9] },
    hard: { first: [2, 12], second: [2, 12] },
  },
} as const satisfies Record<string, Record<(typeof LEVELS)[number], Ranges>>

/** The reward menu: a stable id, a name and a price in Macaronis (SPEC §6.7). */
export const REWARDS = [
  { id: 'ice-cream', name: 'Ice Cream', price: 30 },
  { id: 'pet-store', name: 'Pet Store', price: 75 },
  { id: 'camping', name: 'Camping', price: 300 },
  { id: 'puppy', name: 'Puppy', price: 10000 },
] as const

export type RewardId = (typeof REWARDS)[number]['id']
