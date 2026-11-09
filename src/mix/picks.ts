// The mix screen's pure rules (SPEC §5.1 step 2): which cells she has picked, in pick order.
import { LEVELS, MAX_PICKS, type Level, type Mix, type Operation, type Pick } from '../engine'

export const OPERATIONS: readonly Operation[] = ['addition', 'subtraction', 'multiplication', 'division']
export { LEVELS, MAX_PICKS }

/** The sample problem on each cell, easy to hard (SPEC §5.1 step 2): the numbers as written, `a` first. */
export const SAMPLES: Record<Operation, readonly [number, number][]> = {
  addition: [
    [3, 4],
    [27, 16],
    [248, 375],
  ],
  subtraction: [
    [8, 3],
    [42, 17],
    [504, 268],
  ],
  multiplication: [
    [3, 4],
    [7, 8],
    [24, 6],
  ],
  division: [
    [12, 3],
    [56, 7],
    [144, 12],
  ],
}

export const samePick = (x: Pick, y: Pick): boolean => x.operation === y.operation && x.level === y.level

export const isPicked = (picks: Mix, pick: Pick): boolean => picks.some((p) => samePick(p, pick))

/**
 * Taps a cell: a pick is unpicked, and an unpicked cell goes last in the order. With 3 picks other cells take
 * no taps, so a swap is an unpick and then a new pick.
 */
export function togglePick(picks: Mix, pick: Pick): Mix {
  if (isPicked(picks, pick)) return picks.filter((p) => !samePick(p, pick))
  return picks.length >= MAX_PICKS ? picks : [...picks, pick]
}

export type { Level }
