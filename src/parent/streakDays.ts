// The Streak screen's day maths (SPEC §5.3, §7.T). Pure: days are YYYY-MM-DD and are read as UTC, so no
// time zone moves one.

import { COPY } from '../copy'
import { addDays } from '../engine'
import { formatCalendarDay } from '../ui/format'
import { streakFields } from './streakForm'

export interface Tile {
  day: string
  /** The weekday letter. */
  weekday: string
  /** The day of the month. */
  date: number
  state: 'counted' | 'today' | 'idle'
  /** A check shows under a counted day, and under today only when it is counted. */
  check: boolean
}

/** The seven days ending `today`, oldest first; a day is counted when `counted` lists it. */
export function weekStrip(today: string, counted: string[]): Tile[] {
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(today, i - 6)
    const isCounted = counted.includes(day)
    return {
      day,
      weekday: COPY.parentWeekdayLetters[new Date(`${day}T00:00:00Z`).getUTCDay()],
      date: Number(day.slice(8)),
      state: day === today ? 'today' : isCounted ? 'counted' : 'idle',
      check: isCounted,
    }
  })
}

/** The month that names the strip: "October". */
export function monthName(today: string): string {
  return new Date(`${today}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })
}

/**
 * The days a streak covers, ending on the last counted day; `cap` limits it to that many days. Null with
 * no streak or no last counted day.
 */
export function streakRange(
  streak: number,
  lastDay: string | null,
  cap?: number,
): { start: string; end: string } | null {
  if (streak <= 0 || lastDay === null) return null
  const days = cap === undefined ? streak : Math.min(streak, cap)
  return { start: addDays(lastDay, 1 - days), end: lastDay }
}

/** "Oct 14–16", "Oct 29–Nov 2", "Oct 16"; both ends carry the year only when their years differ. */
export function formatRange(start: string, end: string): string {
  if (start === end) return formatCalendarDay(end)
  if (start.slice(0, 4) !== end.slice(0, 4)) {
    return `${formatCalendarDay(start)}, ${start.slice(0, 4)}–${formatCalendarDay(end)}, ${end.slice(0, 4)}`
  }
  const sameMonth = start.slice(0, 7) === end.slice(0, 7)
  return `${formatCalendarDay(start)}–${sameMonth ? Number(end.slice(8)) : formatCalendarDay(end)}`
}

/** The preview under the boxes, or null when the boxes can't be sent (SPEC §5.3). */
export function previewText(oldStreak: number, streakText: string, dayText: string): string | null {
  const fields = streakFields(streakText, dayText)
  if (!fields) return null
  const range = streakRange(fields.streak, fields.lastDay)
  return COPY.parentStreakPreview(range ? formatRange(range.start, range.end) : null, oldStreak, fields.streak)
}
