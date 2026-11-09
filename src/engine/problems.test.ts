import { describe, expect, it } from 'vitest'
import { LEVELS, RANGES } from './config'
import snapshot from './fixed-mix.snapshot.json'
import { generateAssignment, isMix, makeProblem, type Level, type Mix, type Operation } from './problems'

const SEEDS = Array.from({ length: 1000 }, (_, i) => i)
const OPERATIONS = Object.keys(RANGES) as Operation[]
const CELLS = OPERATIONS.flatMap((operation) => LEVELS.map((level) => ({ operation, level })))
const digits = (n: number) => String(n).length
const SYMBOL = { addition: '+', subtraction: '-', multiplication: '*', division: '/' } as const
const line = (p: { operation: Operation; a: number; b: number; answer: number }) =>
  `${p.a} ${SYMBOL[p.operation]} ${p.b} = ${p.answer}`
/** Every problem of one cell from 1,000 seeds (a one-pick mix gives 20 each). */
const cell = (operation: Operation, level: Level) =>
  SEEDS.flatMap((seed) => generateAssignment(seed, [{ operation, level }]))
const inRange = (n: number, [min, max]: readonly [number, number]) => n >= min && n <= max
const M10: Mix = [
  { operation: 'multiplication', level: 'medium' },
  { operation: 'division', level: 'easy' },
  { operation: 'addition', level: 'hard' },
]

describe('generator (SPEC §6.1, §6.2)', () => {
  it('M1: one pick gives 20 problems, all of that operation and level', () => {
    for (const pick of CELLS) {
      const problems = generateAssignment(7, [pick])
      expect(problems).toHaveLength(20)
      for (const p of problems) expect([p.operation, p.level]).toEqual([pick.operation, pick.level])
    }
  })

  it('M2: addition and subtraction numbers are in the level range, and every value comes up', () => {
    for (const operation of ['addition', 'subtraction'] as const) {
      for (const level of LEVELS) {
        const { first, second } = RANGES[operation][level]
        const seen = new Set<number>()
        for (const p of cell(operation, level)) {
          // Subtraction swaps so the larger number is first; both numbers still come from the range.
          expect(inRange(p.a, first) && inRange(p.b, second), `${operation} ${level} ${line(p)}`).toBe(true)
          seen.add(p.a).add(p.b)
        }
        // 1 to 9 and 10 to 99 are fully covered; 100 to 999 only needs its ends and digit count.
        if (level !== 'hard') expect(seen.size, `${operation} ${level}`).toBe(first[1] - first[0] + 1)
        else expect([Math.min(...seen), Math.max(...seen)]).toEqual([100, 999])
      }
    }
  })

  it('M3: subtraction puts the larger number first; the answer is never negative', () => {
    for (const level of LEVELS) {
      for (const p of cell('subtraction', level)) {
        expect(p.a).toBeGreaterThanOrEqual(p.b)
        expect(p.answer).toBe(p.a - p.b)
        expect(p.answer).toBeGreaterThanOrEqual(0)
      }
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

  it('M5: 999 + 999 → 1,998, one more digit than the numbers', () => {
    const p = makeProblem('addition', 999, 999)
    expect(p.answer).toBe(1998)
    expect(digits(p.answer)).toBe(digits(p.a) + 1)
  })

  it('M6: multiplication factors are in the level range, and every value comes up', () => {
    for (const level of LEVELS) {
      const { first, second } = RANGES.multiplication[level]
      const firsts = new Set<number>()
      const seconds = new Set<number>()
      for (const p of cell('multiplication', level)) {
        expect(inRange(p.a, first) && inRange(p.b, second), `${level} ${line(p)}`).toBe(true)
        expect(p.answer).toBe(p.a * p.b)
        firsts.add(p.a)
        seconds.add(p.b)
      }
      expect(firsts.size, `${level} first`).toBe(first[1] - first[0] + 1)
      expect(seconds.size, `${level} second`).toBe(second[1] - second[0] + 1)
    }
  })

  it('M8: the same seed and mix, generated twice → identical problems in identical order', () => {
    expect(generateAssignment(20261017, M10)).toEqual(generateAssignment(20261017, M10))
    expect(generateAssignment(20261017)).toEqual(generateAssignment(20261017))
  })

  it('M9: two picks give 10 and 10 problems, shuffled together', () => {
    const mix: Mix = [
      { operation: 'addition', level: 'easy' },
      { operation: 'division', level: 'hard' },
    ]
    const problems = generateAssignment(3, mix)
    expect(problems.filter((p) => p.operation === 'addition')).toHaveLength(10)
    expect(problems.filter((p) => p.operation === 'division')).toHaveLength(10)
    // Not grouped: the first ten aren't all one pick.
    expect(new Set(problems.slice(0, 10).map((p) => p.operation)).size).toBe(2)
  })

  it('M10: three picks give 7, 7 and 6 problems, the 6 going to the last pick', () => {
    const problems = generateAssignment(5, M10)
    const count = (operation: Operation) => problems.filter((p) => p.operation === operation).length
    expect([count('multiplication'), count('division'), count('addition')]).toEqual([7, 7, 6])
    // The same picks in another order move the 6.
    const reordered = generateAssignment(5, [M10[2], M10[0], M10[1]])
    expect(reordered.filter((p) => p.operation === 'addition')).toHaveLength(7)
    expect(reordered.filter((p) => p.operation === 'division')).toHaveLength(6)
  })

  it('M11: division is exact, with divisor and answer in the level range, every value coming up', () => {
    for (const level of LEVELS) {
      const { first, second } = RANGES.division[level]
      const divisors = new Set<number>()
      const answers = new Set<number>()
      for (const p of cell('division', level)) {
        expect(Number.isInteger(p.a / p.b), line(p)).toBe(true)
        expect(p.answer).toBe(p.a / p.b)
        expect(inRange(p.b, first) && inRange(p.answer, second), `${level} ${line(p)}`).toBe(true)
        divisors.add(p.b)
        answers.add(p.answer)
      }
      expect(divisors.size, `${level} divisor`).toBe(first[1] - first[0] + 1)
      expect(answers.size, `${level} answer`).toBe(second[1] - second[0] + 1)
    }
  })

  it('M13: seed 1 with no mix is the fixed mix: 7 addition, 7 subtraction, 6 multiplication', () => {
    const problems = generateAssignment(1)
    const counts = { addition: 0, subtraction: 0, multiplication: 0, division: 0 }
    for (const p of problems) counts[p.operation]++
    expect(counts).toEqual({ addition: 7, subtraction: 7, multiplication: 6, division: 0 })
    expect(problems.slice(0, 4).map(line)).toEqual([
      '463 + 322 = 785',
      '1 * 7 = 7',
      '692 - 591 = 101',
      '74885 - 27353 = 47532',
    ])
    expect(problems.map(line)).toEqual([
      '463 + 322 = 785',
      '1 * 7 = 7',
      '692 - 591 = 101',
      '74885 - 27353 = 47532',
      '7 * 4 = 28',
      '540 + 160 = 700',
      '50974 + 53990 = 104964',
      '484 - 138 = 346',
      '7486 + 4832 = 12318',
      '8188 - 3653 = 4535',
      '1024 + 5747 = 6771',
      '97154 + 35299 = 132453',
      '2 * 9 = 18',
      '2 * 0 = 0',
      '471 - 324 = 147',
      '9950 - 7933 = 2017',
      '5 * 1 = 5',
      '6 * 8 = 48',
      '781 - 237 = 544',
      '7903 + 3572 = 11475',
    ])
  })

  // The Worker regenerates saved results on a newer build than the app that made them, so the fixed mix
  // may never change. The hashes were made from the generator as it was before mixes existed.
  it('the fixed mix gives the same problems as before mixes existed, for every snapshot seed', () => {
    const fnv = (s: string) => {
      let h = 0x811c9dc5
      for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0
      return h.toString(16).padStart(8, '0')
    }
    for (const [seed, hash] of Object.entries(snapshot)) {
      const text = generateAssignment(Number(seed))
        .map((p) => `${p.operation[0]}${p.a},${p.b},${p.answer}`)
        .join(';')
      expect(fnv(text), `seed ${seed}`).toBe(hash)
    }
    expect(Object.keys(snapshot).length).toBeGreaterThan(400)
  })

  // Saved results carry their mix, so the order of draws on the mix path is as fixed as the fixed mix.
  it('draws a mix in a fixed order: seed 1 with the M10 mix', () => {
    expect(generateAssignment(1, M10).map(line)).toEqual([
      '748 + 508 = 1256',
      '3 / 1 = 3',
      '1 * 4 = 4',
      '315 + 781 = 1096',
      '4 / 2 = 2',
      '692 + 591 = 1283',
      '2 / 2 = 1',
      '4 * 4 = 16',
      '237 + 390 = 627',
      '793 + 995 = 1788',
      '782 + 273 = 1055',
      '2 / 2 = 1',
      '6 * 0 = 0',
      '6 * 7 = 42',
      '5 * 9 = 45',
      '8 / 2 = 4',
      '12 / 3 = 4',
      '9 * 2 = 18',
      '4 * 9 = 36',
      '3 / 3 = 1',
    ])
  })

  it('the fixed mix picks 3, 4 and 5 digits about equally often', () => {
    const problems = SEEDS.flatMap((s) => generateAssignment(s)).filter(
      (p) => p.operation !== 'multiplication',
    )
    for (const d of [3, 4, 5]) {
      const share = problems.filter((p) => digits(p.a) === d).length / problems.length
      expect(share, `${d} digits`).toBeGreaterThan(0.3)
      expect(share, `${d} digits`).toBeLessThan(0.37)
    }
    for (const p of problems) expect(digits(p.a) === digits(p.b) || p.operation === 'subtraction').toBe(true)
  })

  it('rejects seeds that are not whole numbers from 0 to 2^32 − 1, with or without a mix', () => {
    for (const seed of [0.5, -1, 2 ** 32, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => generateAssignment(seed), String(seed)).toThrow(RangeError)
      expect(() => generateAssignment(seed, M10), String(seed)).toThrow(RangeError)
    }
    expect(() => generateAssignment('7' as unknown as number)).toThrow(RangeError)
  })

  it('accepts only 1 to 3 different known picks as a mix', () => {
    const add = { operation: 'addition', level: 'easy' }
    const bad: unknown[] = [
      [],
      [add, add],
      [add, { operation: 'addition', level: 'medium' }, { operation: 'division', level: 'easy' }, M10[0]],
      [{ operation: 'power', level: 'easy' }],
      [{ operation: 'addition', level: 'tough' }],
      [{ operation: 'addition' }],
      [{ ...add, extra: 1 }],
      [{ operation: 'toString', level: 'easy' }],
      [null],
      'addition',
      { 0: add, length: 1 },
    ]
    for (const mix of bad) {
      expect(isMix(mix), JSON.stringify(mix)).toBe(false)
      expect(() => generateAssignment(1, mix as Mix)).toThrow(RangeError)
    }
    expect(isMix([add])).toBe(true)
    expect(isMix(M10)).toBe(true)
  })

  it('different seeds give different assignments', () => {
    expect(generateAssignment(1)).not.toEqual(generateAssignment(2))
    expect(generateAssignment(1, M10)).not.toEqual(generateAssignment(2, M10))
  })

  it('shuffles the operations instead of grouping them', () => {
    const firstSeven = generateAssignment(7).slice(0, 7)
    expect(new Set(firstSeven.map((p) => p.operation)).size).toBeGreaterThan(1)
  })

  it('makes subtraction non-negative even when given the smaller number first', () => {
    expect(makeProblem('subtraction', 120, 450)).toMatchObject({ a: 450, b: 120, answer: 330 })
  })
})
