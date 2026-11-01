import { COPY } from '../copy'
import { formatClock, formatDay, isSameLocalDay } from '../ui/format'
import type { Device, ResultRow } from './api'
import type { Tab } from './route'

/** The assignments she finished on `today` (SPEC §5.3 Overview), in the order the API sent them. */
export function todaysAssignments(results: ResultRow[], today: string): ResultRow[] {
  return results.filter((r) => r.finished && r.day === today)
}

/** Her connected (not unpaired) devices, and the latest time any of them sent a result. */
export function connectedDevices(devices: Device[]): { count: number; lastSyncedAt: string | null } {
  let count = 0
  let lastSyncedAt: string | null = null
  for (const d of devices) {
    if (d.revokedAt !== null) continue
    count += 1
    if (d.lastResultAt !== null && (lastSyncedAt === null || d.lastResultAt > lastSyncedAt))
      lastSyncedAt = d.lastResultAt
  }
  return { count, lastSyncedAt }
}

/** "Last synced today, 4:05 pm", "Last synced Oct 12", or "No results yet". */
export function lastSyncedLine(iso: string | null, now: Date): string {
  if (iso === null) return COPY.parentNoResultsYet
  return isSameLocalDay(iso, now)
    ? COPY.parentLastSyncedToday(formatClock(iso))
    : COPY.parentLastSyncedOn(formatDay(iso))
}

/** The screen each Overview shortcut opens (SPEC §7.O O11). */
export const OVERVIEW_LINKS: Record<'macaronis' | 'streak' | 'devices' | 'shop', Tab> = {
  macaronis: 'points',
  streak: 'streak',
  devices: 'devices',
  shop: 'shop',
}
