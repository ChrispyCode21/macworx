// What an activity log entry says (SPEC §5.3), pure so any screen can use it.
import { COPY } from '../copy'
import { formatCalendarDay } from '../ui/format'
import type { Device, LogEntry } from './api'

export type ActivityKind =
  | 'balance'
  | 'streak'
  | 'pairing_code'
  | 'unpair'
  | 'correction'
  | 'child'
  | 'other'

export interface Activity {
  kind: ActivityKind
  /** The entry in plain words. Entries this page doesn't know, or can't read, read as a general change. */
  title: string
  /** The signed number of Macaronis, only for a balance entry that records one. */
  amount?: number
}

function kindOf(action: string): ActivityKind {
  switch (action) {
    case 'balance':
    case 'streak':
    case 'pairing_code':
    case 'unpair':
    case 'correction':
      return action
    case 'child_add':
    case 'child_rename':
      return 'child'
    default:
      return 'other'
  }
}

function titleOf(entry: LogEntry, devices: Device[]): string {
  if (entry.action === 'pairing_code' && typeof entry.detail.name === 'string')
    return COPY.parentLogPairingCode(entry.detail.name)
  if (entry.action === 'unpair') {
    const label = devices.find((d) => d.id === entry.detail.deviceId)?.label
    return COPY.parentLogUnpair(label ?? COPY.parentLogUnknownDevice)
  }
  if (entry.action === 'streak') {
    const after = entry.detail.after as { streak?: unknown; lastDay?: unknown } | null | undefined
    if (typeof after?.streak === 'number' && (typeof after.lastDay === 'string' || after.lastDay === null))
      return COPY.parentLogStreak(after.streak, after.lastDay)
  }
  if (entry.action === 'correction') {
    const { day, before, after, note: why } = entry.detail
    const b = before as { correct?: unknown; total?: unknown } | null | undefined
    const a = after as { correct?: unknown; total?: unknown } | null | undefined
    if (
      typeof day === 'string' &&
      typeof why === 'string' &&
      typeof b?.correct === 'number' &&
      typeof b.total === 'number' &&
      typeof a?.correct === 'number' &&
      typeof a.total === 'number'
    )
      return COPY.parentLogCorrected(formatCalendarDay(day), b.correct, a.correct, a.total - b.total, why)
  }
  if (entry.action === 'child_add' && typeof entry.detail.name === 'string')
    return COPY.parentLogChildAdded(entry.detail.name)
  if (entry.action === 'child_rename') {
    const b = entry.detail.before as { name?: unknown } | null | undefined
    const a = entry.detail.after as { name?: unknown } | null | undefined
    if (typeof b?.name === 'string' && typeof a?.name === 'string')
      return b.name === a.name
        ? COPY.parentLogChildChanged(a.name)
        : COPY.parentLogChildRenamed(b.name, a.name)
  }
  const { amount, note } = entry.detail
  if (entry.action === 'balance' && typeof amount === 'number' && typeof note === 'string')
    return amount < 0 ? COPY.parentLogRemoved(-amount, note) : COPY.parentLogAdded(amount, note)
  return COPY.parentLogOther
}

/** What an activity log entry is and says. */
export function describe(entry: LogEntry, devices: Device[]): Activity {
  const result: Activity = { kind: kindOf(entry.action), title: titleOf(entry, devices) }
  if (entry.action === 'balance' && typeof entry.detail.amount === 'number')
    result.amount = entry.detail.amount
  return result
}
