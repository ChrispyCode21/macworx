// The one config module (CLAUDE.md): payout values, grade cutoffs, assignment shape, generator
// ranges and reward prices. Change a number here, and its SPEC.md section and §7 examples with it.

/** Macaroni payout (SPEC §6.4). */
export const PAYOUT = {
  perCorrect: 1,
  /** Accuracy bonus: this percent of the correct answers, rounded down. */
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

/** The reward menu: a stable id, a name and a price in Macaronis (SPEC §6.7). */
export const REWARDS = [
  { id: 'ice-cream', name: 'Ice Cream', price: 30 },
  { id: 'pet-store', name: 'Pet Store', price: 75 },
  { id: 'camping', name: 'Camping', price: 300 },
  { id: 'puppy', name: 'Puppy', price: 10000 },
] as const

export type RewardId = (typeof REWARDS)[number]['id']
