// The grade of one assignment (SPEC §6.6).
import { GRADES, type Grade } from './config'

export function grade(correct: number, problemCount: number): Grade {
  const valid =
    Number.isInteger(correct) &&
    Number.isInteger(problemCount) &&
    problemCount >= 1 &&
    correct >= 0 &&
    correct <= problemCount
  if (!valid) throw new RangeError(`Invalid result: ${correct} of ${problemCount}`)
  // Whole-number comparison, so exactly 90% is Great: 18 × 100 >= 90 × 20.
  const match = GRADES.find((g) => correct * 100 >= g.minPercent * problemCount)
  return (match ?? GRADES[GRADES.length - 1]).label
}
