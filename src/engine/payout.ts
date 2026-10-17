// Macaroni payout for a finished assignment (SPEC §6.4).
import { PAYOUT } from './config'

export interface PayoutInput {
  correct: number
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

export function payout({ correct, problemCount, firstOfDay, streak }: PayoutInput): Payout {
  const valid =
    [correct, problemCount, streak].every(Number.isInteger) &&
    problemCount >= 1 &&
    correct >= 0 &&
    correct <= problemCount &&
    streak >= 0
  if (!valid) throw new RangeError(`Invalid result: ${correct} of ${problemCount}, streak ${streak}`)

  const base = correct * PAYOUT.perCorrect
  // Whole numbers only, so no rounding error: 20% of 17 is floor(340 / 100) = 3.
  const accuracyBonus = Math.floor((correct * PAYOUT.accuracyBonusPercent) / 100)
  const streakBonus = firstOfDay ? Math.min(streak * PAYOUT.streakPerDay, PAYOUT.streakCap) : 0
  const total = Math.max(PAYOUT.minimum, base + accuracyBonus + streakBonus)
  return { base, accuracyBonus, streakBonus, total }
}
