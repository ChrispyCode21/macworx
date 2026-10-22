// Every piece of text she sees, in one place (SPEC §4: never-negative wording).
import { ASSIGNMENT_SIZE, type Grade } from './engine'
import { formatNumber } from './ui/format'

export const COPY = {
  title: 'macworx',
  start: 'Start',
  startHint: `${ASSIGNMENT_SIZE} problems. Take your time.`,
  connectForProblems: 'Connect to Wi-Fi to get more problems!',
  progress: (n: number, total: number) => `Problem ${n} of ${total}`,
  leave: 'Done for now',
  check: 'Check',
  delete: 'Delete',
  deleteKey: '⌫',
  next: 'Next',
  seeResult: 'See how I did',
  /** Rotates by problem number. */
  cheers: ['You got it!', 'Yes!', 'Nice work!', "That's right!"],
  showHow: "Here's how that one works:",
  keepGoing: 'Keep going!',
  /** Instead of "Keep going!" when it was the last problem. */
  lastOne: 'That was the last one!',
  rightCount: (correct: number, total: number) => `${correct} of ${total} right`,
  didProblems: (n: number) => `You did ${n} ${n === 1 ? 'problem' : 'problems'}.`,
  macaronis: (n: number) => `${formatNumber(n)} ${n === 1 ? 'Macaroni' : 'Macaronis'}`,
  /** The parts of a finished payout; a bonus of 0 is left out. */
  bonus: (base: number, accuracy: number, streak: number) =>
    `${formatNumber(base)}${accuracy > 0 ? ` + ${formatNumber(accuracy)} bonus` : ''}${
      streak > 0 ? ` + ${formatNumber(streak)} streak bonus` : ''
    } = `,
  completedCount: (n: number) => `${formatNumber(n)} ${n === 1 ? 'assignment' : 'assignments'} done`,
  streakDays: (n: number) => `${formatNumber(n)} day streak`,
  latestGrade: (grade: Grade) => `Latest: ${grade}`,
  anotherOne: 'Do another one',
  // Pairing her iPad (SPEC §5.4)
  pairThisIpad: 'Pair this iPad',
  pairTitle: 'Pair this iPad',
  pairInstruction: 'Ask a grown-up for the 6-digit code, then type it here.',
  pairKey: 'Pair',
  back: 'Back',
  paired: 'This iPad is paired!',
  pairedDone: 'Done',
  pairNotAccepted: "Hmm, that code isn't working. Ask a grown-up for a new one.",
  pairTooManyTries: "Let's wait a minute, then try again.",
  pairOffline: 'Connect to Wi-Fi to pair this iPad.',
  pairBusy: "Something's busy right now. Try again in a minute.",
  // The parent page (SPEC §5.3), for a parent
  parentTitle: 'macworx · Parent',
  parentPairHeading: 'Pair an iPad',
  parentNameLabel: 'iPad name',
  parentNameHint: 'Up to 40 characters, e.g. "Her iPad"',
  parentMakeCode: 'Make a code',
  parentCodeWithin: (minutes: number) =>
    `Enter it on the iPad within ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`,
  parentCodeRanOut: 'This code has run out. Make a new one.',
  parentDevicesHeading: 'Paired iPads',
  parentPairedOn: (day: string) => `Paired ${day}`,
  parentUnpairedOn: (day: string) => `Unpaired ${day}`,
  parentUnpair: 'Unpair',
  parentUnpairConfirm: (name: string) => `Unpair ${name}? Results this iPad hasn't sent yet won't be saved.`,
  parentKeepPaired: 'Keep it paired',
  parentNoDevices: 'No iPads paired yet.',
  parentNameProblem: 'Give the iPad a name of up to 40 characters.',
  parentSignedOut: 'Your sign-in has run out. Reload the page to sign in again.',
  parentOffline: 'No connection. Check the Wi-Fi and try again.',
  parentServerTrouble: 'Something went wrong on our side. Try again in a minute.', // conventions-ignore: parent-facing, approved in #18
  home: 'Home',
} as const

/** Result heading and line for each grade (SPEC §6.6). Keys stay unquoted: labels live in config.ts. */
export const GRADE_COPY: Record<Grade, { heading: string; line: string }> = {
  Excellent: { heading: 'Excellent!', line: 'Every single one right.' },
  Great: { heading: 'Great work!', line: 'Almost every one.' },
  Good: { heading: 'Good work!', line: "You're getting stronger." },
  Improving: { heading: 'Improving!', line: 'Every problem makes you better at this.' },
}
