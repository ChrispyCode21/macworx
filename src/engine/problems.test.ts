import { describe, expect, it } from 'vitest'
import { generateAssignment, makeProblem, type Problem } from './problems'

const SEEDS = Array.from({ length: 1000 }, (_, i) => i)
const all = (operation: Problem['operation']) =>
  SEEDS.flatMap((seed) => generateAssignment(seed)).filter((p) => p.operation === operation)
const digits = (n: number) => String(n).length

describe('generator (SPEC §6.1, §6.2)', () => {
  it('M1: any seed → 7 addition, 7 subtraction, 6 multiplication', () => {
    for (const seed of [0, 1, 42, 2 ** 32 - 1]) {
      const counts = { addition: 0, subtraction: 0, multiplication: 0 }
      for (const p of generateAssignment(seed)) counts[p.operation]++
      expect(counts).toEqual({ addition: 7, subtraction: 7, multiplication: 6 })
    }
  })

  it('M2: addition and subtraction numbers share one digit count, 3 to 5', () => {
    const seen = new Set<number>()
    for (const p of [...all('addition'), ...all('subtraction')]) {
      expect(digits(p.a)).toBe(digits(p.b))
      expect([3, 4, 5]).toContain(digits(p.a))
      seen.add(digits(p.a))
    }
    expect([...seen].sort()).toEqual([3, 4, 5])
  })

  it('M3: subtraction puts the larger number first; the answer is never negative', () => {
    for (const p of all('subtraction')) {
      expect(p.a).toBeGreaterThanOrEqual(p.b)
      expect(p.answer).toBe(p.a - p.b)
      expect(p.answer).toBeGreaterThanOrEqual(0)
    }
  })

  it('M4: 4,512 − 4,512 is allowed and gives 0', () => {
    expect(makeProblem('subtraction', 4512, 4512)).toEqual({
      operation: 'subtraction',
      a: 4512,
      b: 4512,
      answer: 0,
    })
  })

  it('M5: 99,999 + 99,999 → 199,998, one more digit than the numbers', () => {
    expect(makeProblem('addition', 99999, 99999).answer).toBe(199998)
  })

  it('M6: multiplication factors run from 0 to 9', () => {
    const factors = new Set<number>()
    for (const p of all('multiplication')) {
      for (const f of [p.a, p.b]) {
        expect(Number.isInteger(f) && f >= 0 && f <= 9).toBe(true)
        factors.add(f)
      }
      expect(p.answer).toBe(p.a * p.b)
    }
    expect(factors.size).toBe(10)
  })

  it('M8: the same seed, generated twice → identical problems in identical order', () => {
    expect(generateAssignment(20261017)).toEqual(generateAssignment(20261017))
  })

  it('different seeds give different assignments', () => {
    expect(generateAssignment(1)).not.toEqual(generateAssignment(2))
  })

  it('shuffles the operations instead of grouping them', () => {
    const firstSeven = generateAssignment(7).slice(0, 7)
    expect(new Set(firstSeven.map((p) => p.operation)).size).toBeGreaterThan(1)
  })

  it('makes subtraction non-negative even when given the smaller number first', () => {
    expect(makeProblem('subtraction', 120, 450)).toMatchObject({ a: 450, b: 120, answer: 330 })
  })
})
