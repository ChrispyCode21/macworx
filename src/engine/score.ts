// Scoring (SPEC §6.3).
import type { Problem } from './problems'

/** Her answer is correct when it is a whole number equal to the computed answer. */
export function checkAnswer(problem: Problem, answer: number): boolean {
  return Number.isInteger(answer) && answer === problem.answer
}
