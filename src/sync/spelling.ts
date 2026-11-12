// A spelling assignment (SPEC §5.7, §6.8): the Worker chooses the words and re-marks her typing, so both calls need a
// connection. Nothing about spelling is stored on the iPad; only the Worker's state is, as for a math result.
import { getDeviceKey } from '../storage/device'
import { post, readBody, unpaired } from './reading'
import { localDay, saveWorkerState, syncBeforeReading } from './sync'

export interface AssignedWord {
  id: number
  word: string
  sentence: string
  alternates: readonly string[]
}

export interface SpellingResult {
  correct: number
  answered: number
  payout: { base: number; accuracyBonus: number; streakBonus: number; total: number }
}

export interface Typed {
  word: number
  typed: string
}

export type StartOutcome =
  { kind: 'words'; attempt: number; words: AssignedWord[] } | { kind: 'sample' } | { kind: 'offline' }

export type FinishOutcome =
  | { kind: 'checked'; result: SpellingResult }
  | { kind: 'offline' }
  /** A parent changed one of the words, so the attempt is gone and nothing was recorded (SPEC §5.7 step 3). */
  | { kind: 'voided' }

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

function isWord(value: unknown): value is AssignedWord {
  return (
    isObject(value) &&
    typeof value.id === 'number' &&
    typeof value.word === 'string' &&
    typeof value.sentence === 'string' &&
    Array.isArray(value.alternates) &&
    value.alternates.every((a) => typeof a === 'string')
  )
}

function isResult(value: unknown): value is SpellingResult {
  if (!isObject(value) || !isObject(value.payout)) return false
  const p = value.payout
  return (
    typeof value.correct === 'number' &&
    typeof value.answered === 'number' &&
    ['base', 'accuracyBonus', 'streakBonus', 'total'].every((k) => typeof p[k] === 'number')
  )
}

/**
 * She taps Spelling: unsent math results go first, then the Worker hands out her next words. An iPad that isn't
 * paired, or a Worker with no words, gets the sample (§5.5); no connection gets the Wi-Fi line (§5.7 step 1).
 */
export async function startSpelling(): Promise<StartOutcome> {
  if (!getDeviceKey()) return { kind: 'sample' }
  if (!(await syncBeforeReading())) return getDeviceKey() ? { kind: 'offline' } : { kind: 'sample' }
  const key = getDeviceKey()
  if (!key) return { kind: 'sample' }
  const response = await post(key, '/api/spelling/start', {})
  if (!response) return { kind: 'offline' }
  if (unpaired(response, key)) return { kind: 'sample' }
  const body = response.ok ? await readBody(response) : null
  if (!body || !('words' in body)) return { kind: 'offline' }
  if (body.words === null) return { kind: 'sample' }
  const { attempt, words } = body
  if (typeof attempt !== 'number' || !Array.isArray(words) || words.length === 0 || !words.every(isWord))
    return { kind: 'offline' }
  return { kind: 'words', attempt, words }
}

/**
 * Finish: her typing goes with the attempt `start` gave and the iPad's own day (§6.8). Never calls `start` again, so a
 * retry keeps the attempt, and the Worker returns the recorded result for it instead of paying twice. Unsent math
 * results go first, so the streak is counted in order.
 */
export async function finishSpelling(attempt: number, answers: Typed[], now: Date): Promise<FinishOutcome> {
  if (!getDeviceKey()) return { kind: 'offline' }
  if (!(await syncBeforeReading())) return { kind: 'offline' }
  const key = getDeviceKey()
  if (!key) return { kind: 'offline' }
  const response = await post(key, '/api/spelling/result', { attempt, day: localDay(now), answers })
  if (!response) return { kind: 'offline' }
  if (response.status === 404) return { kind: 'voided' }
  if (unpaired(response, key) || !response.ok) return { kind: 'offline' }
  const body = await readBody(response)
  const result = body?.result
  if (!isResult(result)) return { kind: 'offline' }
  saveWorkerState(body?.state)
  return { kind: 'checked', result }
}
