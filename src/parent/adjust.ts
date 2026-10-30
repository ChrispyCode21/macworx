// The checks on a balance adjustment (SPEC §5.3), pure so any screen can use them.
import { MAX_AMOUNT, MAX_NOTE } from './api'

/** The whole number a parent typed, 1 to MAX_AMOUNT, or null when it can't be an amount. */
export function parseAmount(text: string): number | null {
  const trimmed = text.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const count = Number(trimmed)
  return count >= 1 && count <= MAX_AMOUNT ? count : null
}

/** Her balance after a signed amount (negative removes). */
export function balanceAfter(balance: number, amount: number): number {
  return balance + amount
}

export type AdjustProblem = 'bad_amount' | 'bad_note' | 'below_zero'

export type AdjustCheck =
  | { ok: true; amount: number; note: string; after: number }
  | { ok: false; problem: AdjustProblem }

/** Checks the amount, then the note, then that the balance would not end below 0. */
export function checkAdjust({
  amountText,
  note,
  removing,
  balance,
}: {
  amountText: string
  note: string
  removing: boolean
  balance: number
}): AdjustCheck {
  const count = parseAmount(amountText)
  if (count === null) return { ok: false, problem: 'bad_amount' }
  const trimmed = note.trim()
  if (trimmed.length < 1 || trimmed.length > MAX_NOTE) return { ok: false, problem: 'bad_note' }
  const amount = removing ? -count : count
  const after = balanceAfter(balance, amount)
  if (after < 0) return { ok: false, problem: 'below_zero' }
  return { ok: true, amount, note: trimmed, after }
}
