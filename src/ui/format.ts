// Display formatting, in one place: every number and operator she sees goes through here.
import type { Operation } from '../engine'

export function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

const SYMBOLS: Record<Operation, string> = {
  addition: '+',
  subtraction: '−', // minus sign, wider than a hyphen
  multiplication: '×',
}

export function operatorSymbol(operation: Operation): string {
  return SYMBOLS[operation]
}

/** "463 + 322 = 785", for the response after each answer. */
export function formatEquation(problem: {
  operation: Operation
  a: number
  b: number
  answer: number
}): string {
  const { operation, a, b, answer } = problem
  return `${formatNumber(a)} ${operatorSymbol(operation)} ${formatNumber(b)} = ${formatNumber(answer)}`
}
