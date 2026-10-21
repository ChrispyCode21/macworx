// What Home and the result show before the Worker has re-scored her latest results (SPEC §6.8): the
// Worker's last numbers with each unsent result applied on top, using the engine. Pure: no React, fetch
// or storage access.
import {
  addDays,
  ASSIGNMENT_SIZE,
  checkAnswer,
  dayNumber,
  generateAssignment,
  grade,
  GRADES,
  leftEarlyPayout,
  nextStreak,
  payout,
  type Grade,
  type Payout,
} from '../engine'
import type { QueuedResult, WorkerState } from '../storage/device'

export interface HomeNumbers {
  balance: number
  completed: number
  /** Null when there is no streak to show (SPEC §5.1 step 1). */
  streak: number | null
  /** Null until she has a graded assignment. */
  latestGrade: Grade | null
}

/** A result dated before her last counted day counts as that day (§6.8), as in the Worker. */
function finishedPayout(state: WorkerState, day: string, correct: number) {
  const { lastDay } = state
  const streakDay = lastDay && dayNumber(day) < dayNumber(lastDay) ? lastDay : day
  const next = nextStreak({ streak: state.streak, lastDay }, streakDay)
  const earned = payout({
    correct,
    problemCount: ASSIGNMENT_SIZE,
    firstOfDay: next.firstOfDay,
    streak: next.streak,
  })
  return { next, earned }
}

/** Applies one result, or returns the state as it was when the result isn't valid (the Worker drops it). */
function apply(state: WorkerState, { seed, day, answers }: QueuedResult): WorkerState {
  try {
    const problems = generateAssignment(seed)
    const correct = answers.filter((a, i) => problems[i] && checkAnswer(problems[i], a)).length
    if (answers.length !== ASSIGNMENT_SIZE) {
      const earned = leftEarlyPayout({ correct, answered: answers.length, problemCount: ASSIGNMENT_SIZE })
      return { ...state, balance: state.balance + earned.total }
    }
    const { next, earned } = finishedPayout(state, day, correct)
    return {
      balance: state.balance + earned.total,
      streak: next.streak,
      lastDay: next.lastDay,
      completed: state.completed + 1,
      latestGrade: grade(correct, ASSIGNMENT_SIZE),
    }
  } catch {
    return state
  }
}

/** The Worker's state with every unsent result applied, oldest first. */
export function project(state: WorkerState, queue: QueuedResult[]): WorkerState {
  return queue.reduce(apply, state)
}

/** What a finished assignment with `correct` right answers earns on `today`, after the unsent results. */
export function nextResult(
  state: WorkerState,
  queue: QueuedResult[],
  correct: number,
  today: string,
): Payout {
  return finishedPayout(project(state, queue), today, correct).earned
}

/** The four numbers on Home, or null before the iPad has the Worker's state. */
export function homeNumbers(
  state: WorkerState | null,
  queue: QueuedResult[],
  today: string,
): HomeNumbers | null {
  if (!state) return null
  const now = project(state, queue)
  const showStreak =
    now.streak >= 1 &&
    now.lastDay !== null &&
    [today, addDays(today, -1), addDays(today, 1)].includes(now.lastDay)
  return {
    balance: now.balance,
    completed: now.completed,
    streak: showStreak ? now.streak : null,
    latestGrade: GRADES.find((g) => g.label === now.latestGrade)?.label ?? null,
  }
}
