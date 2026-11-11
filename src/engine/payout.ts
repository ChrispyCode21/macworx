// Macaroni payout for a finished assignment, or one she leaves early (SPEC §6.4).
import { PAYOUT, SPELLING } from './config'

export interface PayoutInput {
  correct: number
  /** The size of the assignment: 20 problems, or a passage's question count. */
  problemCount: number
  /** From nextStreak: whether this is her first finished assignment of the day. */
  firstOfDay: boolean
  /** The streak after nextStreak has counted today. */
  streak: number
}

export interface Payout {
  base: number
  accuracyBonus: number
  streakBonus: number
  /** Macaronis earned: the sum of the parts, raised to the minimum if it's below it. */
  total: number
}

function validate({ correct, problemCount, firstOfDay, streak }: PayoutInput) {
  const valid =
    [correct, problemCount, streak].every(Number.isInteger) &&
    problemCount >= 1 &&
    correct >= 0 &&
    correct <= problemCount &&
    streak >= 0 &&
    // Strictly a boolean, so a "false" string from a request body can't pay the streak bonus.
    typeof firstOfDay === 'boolean'
  if (!valid) throw new RangeError(`Invalid result: ${correct} of ${problemCount}, streak ${streak}`)
}

/** The bonuses and the minimum on top of a base, the same for every kind of assignment (§6.4). */
function settle(base: number, { firstOfDay, streak }: PayoutInput): Payout {
  // 20% of the base, rounded down: 20% of 17 is floor(340 / 100) = 3.
  const accuracyBonus = Math.floor((base * PAYOUT.accuracyBonusPercent) / 100)
  const streakBonus = firstOfDay ? Math.min(streak * PAYOUT.streakPerDay, PAYOUT.streakCap) : 0
  const total = Math.max(PAYOUT.minimum, base + accuracyBonus + streakBonus)
  return { base, accuracyBonus, streakBonus, total }
}

export function payout(input: PayoutInput): Payout {
  validate(input)
  // The correct answers scaled to a 20-problem assignment, rounded down (§6.4).
  const base = Math.floor((input.correct * PAYOUT.perCorrect * PAYOUT.baseScale) / input.problemCount)
  return settle(base, input)
}

/** A spelling assignment: 1 Macaroni per correct word, never scaled, so a list under 20 words pays less (§6.4). */
export function spellingPayout(input: PayoutInput): Payout {
  validate(input)
  // A list is 20 words at most (§6.2), so the unscaled base can't pass the 20 a full assignment pays.
  if (input.problemCount > SPELLING.words)
    throw new RangeError(`Invalid spelling result: ${input.problemCount} words, at most ${SPELLING.words}`)
  return settle(input.correct * PAYOUT.perCorrect, input)
}

export interface LeftEarlyInput {
  correct: number
  /** Problems she answered before leaving: fewer than all of them, or it's a finished assignment. */
  answered: number
  problemCount: number
}

/** An assignment she leaves early pays the base only: no bonuses and no minimum (§6.4). */
export function leftEarlyPayout({ correct, answered, problemCount }: LeftEarlyInput): Payout {
  const valid =
    [correct, answered, problemCount].every(Number.isInteger) &&
    correct >= 0 &&
    correct <= answered &&
    answered < problemCount
  if (!valid)
    throw new RangeError(`Invalid early result: ${correct} of ${answered} answered of ${problemCount}`)
  const base = correct * PAYOUT.perCorrect
  return { base, accuracyBonus: 0, streakBonus: 0, total: base }
}
