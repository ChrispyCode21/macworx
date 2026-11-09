// Scoring a reading assignment (SPEC §6.3).
import { checkChoice } from './choice'

/** How many questions she got right: her pick at each index against that question's right choice. */
export function scoreReading(rightChoices: readonly number[], picks: readonly number[]): number {
  if (rightChoices.length === 0 || picks.length !== rightChoices.length)
    throw new RangeError(`Invalid reading result: ${picks.length} picks for ${rightChoices.length} questions`)
  return rightChoices.filter((right, i) => checkChoice(picks[i]!, right)).length
}
