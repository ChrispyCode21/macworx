// The question engine's public API (SPEC §8). Pure TypeScript, shared by the app and the Worker.
export {
  ASSIGNMENT,
  ASSIGNMENT_SIZE,
  GENERATOR,
  GRADES,
  LEVELS,
  MAX_PICKS,
  MAX_ANSWER,
  PAYOUT,
  RANGES,
  REWARDS,
  type Grade,
  type RewardId,
} from './config'
export { checkChoice } from './choice'
export { grade } from './grade'
export { leftEarlyPayout, payout, type LeftEarlyInput, type Payout, type PayoutInput } from './payout'
export {
  generateAssignment,
  isMix,
  makeProblem,
  pickSizes,
  type Level,
  type Mix,
  type Operation,
  type Pick,
  type Problem,
} from './problems'
export { scoreReading } from './reading'
export { checkAnswer } from './score'
export { addDays, dayNumber, nextStreak, type StreakResult, type StreakState } from './streak'
