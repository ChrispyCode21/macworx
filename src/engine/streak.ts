// The streak (SPEC §6.5). Days are calendar dates in the iPad's local time, passed in as YYYY-MM-DD;
// the engine has no clock.

export interface StreakState {
  /** Consecutive counted days, ending on lastDay. */
  streak: number
  /** The last day she finished an assignment, or null if she never has. */
  lastDay: string | null
}

export interface StreakResult extends StreakState {
  /** Whether this was her first finished assignment of the day, so the streak bonus applies (§6.4). */
  firstOfDay: boolean
}

/** Days since 1970-01-01 for a YYYY-MM-DD date (Hinnant's days_from_civil), with no Date object. */
export function dayNumber(day: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  const [y, m, d] = match ? [Number(match[1]), Number(match[2]), Number(match[3])] : [0, 0, 0]
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
  if (!match || !monthDays || d < 1 || d > monthDays) throw new RangeError(`Not a YYYY-MM-DD date: "${day}"`)

  const year = m <= 2 ? y - 1 : y
  const era = Math.floor(year / 400)
  const yearOfEra = year - era * 400
  const dayOfYear = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1
  const dayOfEra = yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear
  return era * 146097 + dayOfEra - 719468
}

/** The streak after she finishes an assignment today. */
export function nextStreak(state: StreakState, today: string): StreakResult {
  if (!Number.isInteger(state.streak) || state.streak < 0)
    throw new RangeError(`Invalid stored streak: ${state.streak}`)
  const todayNumber = dayNumber(today)
  if (state.lastDay === null) return { streak: 1, lastDay: today, firstOfDay: true }

  const last = dayNumber(state.lastDay)
  // Same day, or a day earlier than the last counted one (clock set back): nothing changes.
  if (todayNumber <= last) return { ...state, firstOfDay: false }
  const streak = todayNumber === last + 1 ? state.streak + 1 : 1
  return { streak, lastDay: today, firstOfDay: true }
}
