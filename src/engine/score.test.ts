import { describe, expect, it } from 'vitest'
import { makeProblem } from './problems'
import { checkAnswer } from './score'

describe('scoring (SPEC §6.3)', () => {
  it('M7: 7 × 8 answered 56 is correct; answered 54 is not', () => {
    const problem = makeProblem('multiplication', 7, 8)
    expect(checkAnswer(problem, 56)).toBe(true)
    expect(checkAnswer(problem, 54)).toBe(false)
  })

  it('only whole numbers can be correct', () => {
    const problem = makeProblem('addition', 100, 200)
    expect(checkAnswer(problem, 300.5)).toBe(false)
    expect(checkAnswer(problem, Number.NaN)).toBe(false)
  })
})
