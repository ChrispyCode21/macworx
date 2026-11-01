import { addDays } from '../engine'

// The streak form's boxes as the Worker wants them (SPEC §5.3, §7.C).

/** The most a streak can be (SPEC §5.3). */
export const MAX_STREAK = 3650

export const WHOLE_NUMBER = /^\d{1,4}$/

/** True for a real YYYY-MM-DD day; the engine's day maths throws on anything else. */
function isCalendarDay(text: string): boolean {
  try {
    return addDays(text, 0) === text
  } catch {
    return false
  }
}

/** The streak form's two boxes as the Worker wants them, or null when they can't be sent (SPEC §5.3). */
export function streakFields(
  streakText: string,
  dayText: string,
): { streak: number; lastDay: string | null } | null {
  const text = streakText.trim()
  if (!WHOLE_NUMBER.test(text) || Number(text) > MAX_STREAK) return null
  const streak = Number(text)
  // Empty goes with a streak of 0 only; anything else must be a real calendar day (a date box can hold 20261-01-01).
  if (dayText === '') return streak === 0 ? { streak, lastDay: null } : null
  if (!isCalendarDay(dayText)) return null
  return { streak, lastDay: dayText }
}
