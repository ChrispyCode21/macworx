import { describe, expect, it } from 'vitest'
import { generateAssignment } from '../engine'
import type { QueuedResult, WorkerState } from '../storage/device'
import { homeNumbers, nextResult, practiceChild, project } from './projection'

const TODAY = '2026-10-17'
const answersFor = (seed: number) => generateAssignment(seed).map((p) => p.answer)
const finished = (seed: number, day = TODAY): QueuedResult => ({ seed, day, answers: answersFor(seed) })
const state = (over: Partial<WorkerState> = {}): WorkerState => ({
  balance: 100,
  streak: 6,
  lastDay: '2026-10-16',
  completed: 10,
  latestGrade: 'Good',
  ...over,
})

describe('a queued result with a mix', () => {
  it("is scored against the mix's problems, as the Worker does (SPEC §6.8)", () => {
    const mix = [{ operation: 'division', level: 'easy' }] as const
    const right = generateAssignment(3, mix).map((p) => p.answer)
    const queued: QueuedResult = { seed: 3, day: TODAY, answers: right, mix }
    // Every answer right against the mix: Excellent and completed +1; scored as the fixed mix it would not be.
    expect(project(state(), [queued])).toMatchObject({ completed: 11, latestGrade: 'Excellent' })
    expect(project(state(), [{ ...queued, mix: undefined }])).not.toMatchObject({ latestGrade: 'Excellent' })
  })
})

describe('her name, grade and initials', () => {
  const child = { name: 'Ada', grade: '4th grade', initials: 'AL' }

  it('survive a finished and a left-early result', () => {
    const early: QueuedResult = { seed: 2, day: TODAY, answers: answersFor(2).slice(0, 5) }
    expect(project(state(child), [finished(1)])).toMatchObject(child)
    expect(project(state(child), [early])).toMatchObject(child)
  })

  it('practiceChild gives them for the practice top bar, or null without a name or initials', () => {
    expect(practiceChild(null)).toBeNull()
    expect(practiceChild(state())).toBeNull() // stored before the Worker sent them
    expect(practiceChild(state({ name: '', grade: '4th grade', initials: '' }))).toBeNull()
    expect(practiceChild(state(child))).toEqual(child)
    expect(practiceChild(state({ name: 'Ada' }))).toEqual({ name: 'Ada', grade: '', initials: '' })
    expect(practiceChild(state({ initials: 'AL' }))).toEqual({ name: '', grade: '', initials: 'AL' })
  })
})

describe('project', () => {
  it('returns the state unchanged for an empty queue', () => {
    expect(project(state(), [])).toEqual(state())
  })

  it('applies a finished result on streak 6, yesterday (S2, P4)', () => {
    expect(project(state(), [finished(1)])).toEqual({
      balance: 131, // 20 + 4 + 7 streak bonus
      streak: 7,
      lastDay: TODAY,
      completed: 11,
      latestGrade: 'Excellent',
    })
  })

  it('pays no streak bonus for the second finished result of a day (S5)', () => {
    const after = project(state(), [finished(1), finished(2)])
    expect(after.balance).toBe(100 + 31 + 24)
    expect(after.streak).toBe(7)
    expect(after.completed).toBe(12)
  })

  it('counts a result dated before the last counted day as that day (W5)', () => {
    const after = project(state({ lastDay: TODAY }), [finished(1, '2026-10-16')])
    expect(after.streak).toBe(6)
    expect(after.lastDay).toBe(TODAY)
    expect(after.balance).toBe(124)
  })

  it('adds only the base for a result she left early (P9, W6)', () => {
    const answers = answersFor(3).slice(0, 5)
    answers[4] = answers[4] + 1
    const after = project(state(), [{ seed: 3, day: TODAY, answers }])
    expect(after).toEqual(state({ balance: 104 }))
  })

  it('skips a malformed queued item', () => {
    const after = project(state(), [{ seed: 1, day: 'nope', answers: answersFor(1) }, finished(2)])
    expect(after.balance).toBe(131)
  })

  it('skips the results the Worker refuses', () => {
    const answers = answersFor(3)
    const refused: QueuedResult[] = [
      { seed: 3, day: TODAY, answers: [...answers, 1] },
      { seed: 3, day: TODAY, answers: [] },
      { seed: 3, day: TODAY, answers: [...answers.slice(0, 4), 1_000_000] },
      { seed: 3, day: TODAY, answers: [...answers.slice(0, 4), -1] },
      { seed: 3, day: TODAY, answers: [...answers.slice(0, 4), 1.5] },
      { seed: 3, day: 'nope', answers: answers.slice(0, 5) },
    ]
    for (const item of refused) expect(project(state(), [item])).toEqual(state())
  })
})

describe('nextResult', () => {
  it('equals what project adds for the same result', () => {
    const queue = [finished(1)]
    const earned = nextResult(state(), queue, 20, TODAY)
    const before = project(state(), queue).balance
    expect(project(state(), [...queue, finished(2)]).balance - before).toBe(earned.total)
    expect(earned.streakBonus).toBe(0)
    expect(nextResult(state(), [], 20, TODAY).streakBonus).toBe(7)
  })
})

describe('homeNumbers', () => {
  it('is null without a state', () => {
    expect(homeNumbers(null, [], TODAY)).toBeNull()
  })

  it('shows the streak for a last day of today, yesterday or tomorrow', () => {
    for (const lastDay of ['2026-10-16', TODAY, '2026-10-18'])
      expect(homeNumbers(state({ lastDay }), [], TODAY)?.streak).toBe(6)
  })

  it('leaves the streak out for 2 days ago, 2 days ahead and a streak of 0', () => {
    for (const lastDay of ['2026-10-15', '2026-10-19'])
      expect(homeNumbers(state({ lastDay }), [], TODAY)?.streak).toBeNull()
    expect(homeNumbers(state({ streak: 0, lastDay: null }), [], TODAY)?.streak).toBeNull()
  })

  it('includes unsent results in all four numbers', () => {
    expect(homeNumbers(state(), [finished(1)], TODAY)).toEqual({
      balance: 131,
      completed: 11,
      streak: 7,
      latestGrade: 'Excellent',
    })
  })

  it('treats an unknown grade as none', () => {
    expect(homeNumbers(state({ latestGrade: 'Superb' }), [], TODAY)?.latestGrade).toBeNull()
    expect(homeNumbers(state({ latestGrade: null }), [], TODAY)?.latestGrade).toBeNull()
  })
})
