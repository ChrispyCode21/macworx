// The math problem generator (SPEC §6.1, §6.2).
import { ASSIGNMENT, ASSIGNMENT_SIZE, GENERATOR, LEVELS, MAX_PICKS, RANGES } from './config'
import { createRng, type Rng } from './random'

export type Operation = 'addition' | 'subtraction' | 'multiplication' | 'division'
export type Level = (typeof LEVELS)[number]

/** One cell of the mix screen: an operation at a level (SPEC §6.1). */
export interface Pick {
  operation: Operation
  level: Level
}

/** 1 to 3 different picks, in the order she picked them (SPEC §6.2). */
export type Mix = readonly Pick[]

export interface Problem {
  operation: Operation
  /** Set on problems made from a mix; the fixed mix's problems carry none (SPEC §6.1). */
  level?: Level
  /** The first number; for division, the dividend. */
  a: number
  /** The second number; for division, the divisor. */
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
    case 'division':
      // The dividend comes first; every division the generator makes is exact (SPEC §6.1).
      return { operation, a, b, answer: a / b }
  }
}

function withDigits(rng: Rng, digits: number): number {
  return rng.int(10 ** (digits - 1), 10 ** digits - 1)
}

function generateProblem(operation: Exclude<Operation, 'division'>, rng: Rng): Problem {
  if (operation === 'multiplication') {
    return makeProblem(operation, rng.int(0, GENERATOR.factorMax), rng.int(0, GENERATOR.factorMax))
  }
  const counts = GENERATOR.digitCounts
  const digits = counts[rng.int(0, counts.length - 1)]
  return makeProblem(operation, withDigits(rng, digits), withDigits(rng, digits))
}

/**
 * The assignment for a seed: the same seed always gives the same problems in the same order.
 * The seed is a whole number from 0 to 2^32 − 1; anything else would be silently folded onto another
 * seed (every fraction onto 0), so it's rejected. With no mix it is the fixed mix (SPEC §6.1): the same
 * draws in the same order as every earlier version, because saved results are re-scored from the seed.
 */
export function generateAssignment(seed: number, mix?: Mix): Problem[] {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new RangeError(`Seed must be a whole number from 0 to 2^32 − 1: ${seed}`)
  if (mix !== undefined) return generateMix(seed, mix)
  const rng = createRng(seed)
  const operations = (Object.keys(ASSIGNMENT) as (keyof typeof ASSIGNMENT)[]).flatMap((op) =>
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

/** Whether `value` is a mix: 1 to 3 different picks, each exactly an operation and a level (SPEC §6.2). */
export function isMix(value: unknown): value is Mix {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_PICKS) return false
  const picks = value as unknown[]
  const known = picks.every(
    (p) =>
      typeof p === 'object' &&
      p !== null &&
      !Array.isArray(p) &&
      Object.keys(p).length === 2 &&
      Object.hasOwn(RANGES, (p as Pick).operation) &&
      LEVELS.includes((p as Pick).level),
  )
  if (!known) return false
  const keys = new Set(picks.map((p) => `${(p as Pick).operation}/${(p as Pick).level}`))
  return keys.size === picks.length
}

function pickProblem(pick: Pick, rng: Rng): Problem {
  const { first, second } = RANGES[pick.operation][pick.level]
  const x = rng.int(first[0], first[1])
  const y = rng.int(second[0], second[1])
  // Division draws the divisor and the answer; the dividend is their product.
  const problem =
    pick.operation === 'division' ? makeProblem('division', x * y, x) : makeProblem(pick.operation, x, y)
  return { ...problem, level: pick.level }
}

/** The 20 problems of a mix (SPEC §6.2): each pick's share in pick order, then shuffled together. */
function generateMix(seed: number, mix: Mix): Problem[] {
  if (!isMix(mix)) throw new RangeError('A mix is 1 to 3 different picks, each an operation and a level')
  const rng = createRng(seed)
  const share = Math.floor(ASSIGNMENT_SIZE / mix.length)
  const extra = ASSIGNMENT_SIZE % mix.length
  const problems = mix.flatMap((pick, i) =>
    Array.from({ length: share + (i < extra ? 1 : 0) }, () => pickProblem(pick, rng)),
  )
  for (let i = problems.length - 1; i > 0; i--) {
    const j = rng.int(0, i)
    ;[problems[i], problems[j]] = [problems[j], problems[i]]
  }
  return problems
}
