// Typing on the number pad: pure helpers for the assignment screen.
import { GENERATOR } from '../engine'

/** The largest answer is one digit longer than the longest numbers: 99,999 + 99,999 = 199,998. */
export const MAX_DIGITS = Math.max(...GENERATOR.digitCounts) + 1

/** Adds a digit to what she has typed. No leading zeros, but a lone 0 is a real answer (4,512 − 4,512). */
export function typeDigit(typed: string, digit: number): string {
  if (typed.length >= MAX_DIGITS) return typed
  if (typed === '0') return String(digit)
  return typed + String(digit)
}

export function deleteDigit(typed: string): string {
  return typed.slice(0, -1)
}
