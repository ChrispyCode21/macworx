// The streak form's boxes as the Worker wants them (SPEC §5.3, §7.C).

/** The most a streak can be (SPEC §5.3). */
export const MAX_STREAK = 3650

export const WHOLE_NUMBER = /^\d{1,4}$/

/** The streak form's two boxes as the Worker wants them, or null when they can't be sent (SPEC §5.3). */
export function streakFields(
  streakText: string,
  dayText: string,
): { streak: number; lastDay: string | null } | null {
  const text = streakText.trim()
  if (!WHOLE_NUMBER.test(text) || Number(text) > MAX_STREAK) return null
  const streak = Number(text)
  // The date box only ever holds a real date or nothing; empty goes with a streak of 0 only.
  if (dayText === '') return streak === 0 ? { streak, lastDay: null } : null
  return { streak, lastDay: dayText }
}
