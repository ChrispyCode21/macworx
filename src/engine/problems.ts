// The math problem generator (SPEC §6.1, §6.2).
import { ASSIGNMENT, GENERATOR } from './config'
import { createRng, type Rng } from './random'

export type Operation = 'addition' | 'subtraction' | 'multiplication'

export interface Problem {
  operation: Operation
  a: number
  b: number
  /** Computed here, never entered: what her answer is checked against (§6.3). */
  answer: number
}

/** A problem with its computed answer. Subtraction puts the larger number first, so it's never negative. */
export function makeProblem(operation: Operation, a: number, b: number): Problem {
  switch (operation) {
    case 'addition':
      return { operation, a, b, answer: a + b }
    case 'subtraction': {
      const [big, small] = a >= b ? [a, b] : [b, a]
      return { operation, a: big, b: small, answer: big - small }
    }
    case 'multiplication':
      return { operation, a, b, answer: a * b }
  }
}

function withDigits(rng: Rng, digits: number): number {
  return rng.int(10 ** (digits - 1), 10 ** digits - 1)
}

function generateProblem(operation: Operation, rng: Rng): Problem {
  if (operation === 'multiplication') {
    return makeProblem(operation, rng.int(0, GENERATOR.factorMax), rng.int(0, GENERATOR.factorMax))
  }
  const counts = GENERATOR.digitCounts
  const digits = counts[rng.int(0, counts.length - 1)]
  return makeProblem(operation, withDigits(rng, digits), withDigits(rng, digits))
}

/** The assignment for a seed: the same seed always gives the same problems in the same order. */
export function generateAssignment(seed: number): Problem[] {
  const rng = createRng(seed)
  const operations = (Object.keys(ASSIGNMENT) as Operation[]).flatMap((op) =>
    Array.from({ length: ASSIGNMENT[op] }, () => op),
  )
  const problems = operations.map((op) => generateProblem(op, rng))
  // Fisher–Yates shuffle, with the same seeded generator.
  for (let i = problems.length - 1; i > 0; i--) {
    const j = rng.int(0, i)
    ;[problems[i], problems[j]] = [problems[j], problems[i]]
  }
  return problems
}
