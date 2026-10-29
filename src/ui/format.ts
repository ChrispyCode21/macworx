// Display formatting, in one place: every number and operator she sees goes through here.
import type { Operation } from '../engine'

export function formatNumber(n: number): string {
  return n.toLocaleString('en-US')
}

const SYMBOLS: Record<Operation, string> = {
  addition: '+',
  subtraction: '−', // minus sign, wider than a hyphen
  multiplication: '×',
}

export function operatorSymbol(operation: Operation): string {
  return SYMBOLS[operation]
}

/** "463 + 322 = 785", for the response after each answer. */
export function formatEquation(problem: {
  operation: Operation
  a: number
  b: number
  answer: number
}): string {
  const { operation, a, b, answer } = problem
  return `${formatNumber(a)} ${operatorSymbol(operation)} ${formatNumber(b)} = ${formatNumber(answer)}`
}

/** "Oct 19", for dates on the parent page. */
export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Whole minutes left until `iso`, rounded up; 0 once it has passed. */
export function minutesLeft(iso: string, now: Date): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now.getTime()) / 60_000))
}

/** "123 456": a pairing code in two groups, easier to read off a screen. */
export function formatCode(code: string): string {
  return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code
}

/** "Oct 17", for a calendar day stored as `YYYY-MM-DD`. Read as UTC so no time zone moves it a day. */
export function formatCalendarDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

/** "Tuesday, October 27", for the parent's calendar day (the viewer's time zone). */
export function formatLongDay(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

/** "Oct 17, 3:05 PM", for when something happened, in the viewer's time zone. */
export function formatMoment(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
