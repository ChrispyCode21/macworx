// The question engine's public API (SPEC §8). Pure TypeScript, shared by the app and the Worker.
export {
  ASSIGNMENT,
  ASSIGNMENT_SIZE,
  GENERATOR,
  GRADES,
  MAX_ANSWER,
  PAYOUT,
  REWARDS,
  type Grade,
} from './config'
export { grade } from './grade'
export { leftEarlyPayout, payout, type LeftEarlyInput, type Payout, type PayoutInput } from './payout'
export { generateAssignment, makeProblem, type Operation, type Problem } from './problems'
export { checkAnswer } from './score'
export { addDays, dayNumber, nextStreak, type StreakResult, type StreakState } from './streak'
