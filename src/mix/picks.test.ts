import { describe, expect, it } from 'vitest'
import type { Pick } from '../engine'
import { isPicked, SAMPLES, togglePick } from './picks'

const add: Pick = { operation: 'addition', level: 'easy' }
const sub: Pick = { operation: 'subtraction', level: 'medium' }
const mul: Pick = { operation: 'multiplication', level: 'hard' }
const div: Pick = { operation: 'division', level: 'easy' }

describe('togglePick', () => {
  it('keeps picks in the order she picked them, and a tap on a pick unpicks it', () => {
    const picks = [sub, add, mul].reduce(togglePick, [] as readonly Pick[])
    expect(picks).toEqual([sub, add, mul])
    expect(togglePick(picks, add)).toEqual([sub, mul])
  })

  it('takes no 4th pick, and the cell picked after a swap goes last', () => {
    const three = [add, sub, mul]
    expect(togglePick(three, div)).toBe(three)
    expect(togglePick(togglePick(three, add), div)).toEqual([sub, mul, div])
  })

  it('tells which cells are picked', () => {
    expect(isPicked([add], { ...add })).toBe(true)
    expect(isPicked([add], { ...add, level: 'hard' })).toBe(false)
  })
})

it("has SPEC §5.1 step 2's sample problems", () => {
  expect(SAMPLES.addition).toEqual([
    [3, 4],
    [27, 16],
    [248, 375],
  ])
  expect(SAMPLES.division[2]).toEqual([144, 12])
})
