// Answer entry on the number pad (SPEC §5.1): pure helpers for the assignment screen.
// `typed` holds her digits in the order she tapped them; the boxes and her answer derive from it.
import { GENERATOR, type Operation, type Problem } from '../engine'

/**
 * - onesFirst: addition and subtraction, worked from the ones place, so each digit goes one column left.
 * - leftToRight: multiplication, written like a number, staying lined up under the ones column.
 */
export type Entry = 'onesFirst' | 'leftToRight'

export function entryFor(operation: Operation): Entry {
  return operation === 'multiplication' ? 'leftToRight' : 'onesFirst'
}

const digitsIn = (n: number) => String(n).length

/** Answer boxes: one per column, plus one for a carry in addition; multiplication fits the largest product. */
export function boxCount(problem: Problem): number {
  switch (problem.operation) {
    case 'addition':
      return digitsIn(Math.max(problem.a, problem.b)) + 1
    case 'subtraction':
      return digitsIn(problem.a)
    case 'multiplication':
      return digitsIn(GENERATOR.factorMax ** 2)
  }
}

/** Adds a tapped digit; a box past the last one takes nothing. */
export function typeDigit(typed: string, digit: number, boxes: number): string {
  return typed.length >= boxes ? typed : typed + String(digit)
}

/** Removes the digit she typed last. */
export function deleteDigit(typed: string): string {
  return typed.slice(0, -1)
}

/** The digits as the boxes show them, left to right: for onesFirst, the first tap is the ones digit. */
export function shownDigits(typed: string, entry: Entry): string {
  return entry === 'onesFirst' ? [...typed].reverse().join('') : typed
}

/** Her answer: the number the boxes show (a leading 0 doesn't change it). */
export function answerValue(typed: string, entry: Entry): number {
  return Number(shownDigits(typed, entry))
}

/**
 * The box her next digit goes in, counted from the left, or null when the boxes are full.
 * onesFirst moves one column left per digit; leftToRight always enters at the ones box and shifts left.
 */
export function nextBox(typed: string, entry: Entry, boxes: number): number | null {
  if (typed.length >= boxes) return null
  return entry === 'onesFirst' ? boxes - 1 - typed.length : boxes - 1
}
