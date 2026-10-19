// Every piece of text she sees, in one place (SPEC §4: never-negative wording).
import { ASSIGNMENT_SIZE, type Grade } from './engine'
import { formatNumber } from './ui/format'

export const COPY = {
  title: 'macworx',
  start: 'Start',
  startHint: `${ASSIGNMENT_SIZE} problems. Take your time.`,
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
  bonus: (base: number, bonus: number) => `${formatNumber(base)} + ${formatNumber(bonus)} bonus = `,
  savingSoon: 'Macaronis start saving soon!',
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
  home: 'Home',
} as const

/** Result heading and line for each grade (SPEC §6.6). Keys stay unquoted: labels live in config.ts. */
export const GRADE_COPY: Record<Grade, { heading: string; line: string }> = {
  Excellent: { heading: 'Excellent!', line: 'Every single one right.' },
  Great: { heading: 'Great work!', line: 'Almost every one.' },
  Good: { heading: 'Good work!', line: "You're getting stronger." },
  Improving: { heading: 'Improving!', line: 'Every problem makes you better at this.' },
}
