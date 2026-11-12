// A reading assignment (SPEC §5.6, §6.8): the Worker chooses the passage and marks her choices, so both calls need
// a connection. Nothing about reading is stored on the iPad; only the Worker's state is, as for a math result.
import { forgetDeviceKey, getDeviceKey } from '../storage/device'
import { localDay, saveWorkerState, syncBeforeReading, TIMEOUT_MS } from './sync'

export interface ReadingPassage {
  id: number
  title: string
  genre: string
  minutes: number
  hint: string
  paragraphs: string[]
  image: string | null
  questions: { id: number; text: string; choices: { id: number; text: string }[] }[]
}

export interface ReadingResult {
  correct: number
  answered: number
  payout: { base: number; accuracyBonus: number; streakBonus: number; total: number }
  questions: { id: number; right: boolean; rightChoice: number; explanation: string }[]
}

export interface Pick {
  question: number
  choice: number
}

export type StartOutcome =
  { kind: 'passage'; attempt: number; passage: ReadingPassage } | { kind: 'sample' } | { kind: 'offline' }

export type CheckOutcome = { kind: 'checked'; result: ReadingResult } | { kind: 'offline' }

export async function post(key: string, path: string, body: unknown): Promise<Response | null> {
  try {
    return await fetch(path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout?.(TIMEOUT_MS),
    })
  } catch {
    return null
  }
}

export const readBody = async (response: Response) =>
  (await response.json().catch(() => null)) as Record<string, unknown> | null

/** A 401 means a parent unpaired this iPad: its key goes, as in a sync (§6.9). */
export function unpaired(response: Response, key: string): boolean {
  if (response.status === 401 && getDeviceKey() === key) forgetDeviceKey()
  return getDeviceKey() !== key
}

/**
 * She taps Reading: unsent math results go first, then the Worker hands out her next passage. An iPad that isn't
 * paired, or a Worker with no passages, gets the sample (§5.5); no connection gets the Wi-Fi line (§5.6).
 */
export async function startReading(): Promise<StartOutcome> {
  if (!getDeviceKey()) return { kind: 'sample' }
  if (!(await syncBeforeReading())) return getDeviceKey() ? { kind: 'offline' } : { kind: 'sample' }
  const key = getDeviceKey()
  if (!key) return { kind: 'sample' }
  const response = await post(key, '/api/reading/start', {})
  if (!response) return { kind: 'offline' }
  if (unpaired(response, key)) return { kind: 'sample' }
  const body = response.ok ? await readBody(response) : null
  if (!body || !('passage' in body)) return { kind: 'offline' }
  if (body.passage === null) return { kind: 'sample' }
  if (typeof body.attempt !== 'number' || !isPassage(body.passage)) return { kind: 'offline' }
  return { kind: 'passage', attempt: body.attempt, passage: body.passage }
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

function isPassage(value: unknown): value is ReadingPassage {
  if (!isObject(value)) return false
  const { title, minutes, paragraphs, questions } = value
  return (
    typeof title === 'string' &&
    typeof minutes === 'number' &&
    Array.isArray(paragraphs) &&
    paragraphs.every((s) => typeof s === 'string') &&
    Array.isArray(questions) &&
    questions.length > 0 &&
    questions.every(
      (q) =>
        isObject(q) &&
        typeof q.id === 'number' &&
        typeof q.text === 'string' &&
        Array.isArray(q.choices) &&
        q.choices.length > 0 &&
        q.choices.every((c) => isObject(c) && typeof c.id === 'number' && typeof c.text === 'string'),
    )
  )
}

function isResult(value: unknown): value is ReadingResult {
  if (!isObject(value) || !isObject(value.payout)) return false
  const { correct, answered, payout, questions } = value
  const p = payout as Record<string, unknown>
  return (
    typeof correct === 'number' &&
    typeof answered === 'number' &&
    ['base', 'accuracyBonus', 'streakBonus', 'total'].every((k) => typeof p[k] === 'number') &&
    Array.isArray(questions) &&
    questions.every(
      (q) =>
        isObject(q) &&
        typeof q.id === 'number' &&
        typeof q.right === 'boolean' &&
        typeof q.rightChoice === 'number',
    )
  )
}

/**
 * Check answers: her choices go with the attempt `start` gave and the iPad's own day (§6.8). Never calls `start`
 * again, so a retry keeps the attempt, and the Worker returns the recorded result for it instead of paying twice.
 */
export async function checkReading(attempt: number, picks: Pick[], now: Date): Promise<CheckOutcome> {
  const key = getDeviceKey()
  if (!key) return { kind: 'offline' }
  const response = await post(key, '/api/reading/result', { attempt, day: localDay(now), picks })
  if (!response || unpaired(response, key) || !response.ok) return { kind: 'offline' }
  const body = await readBody(response)
  const result = body?.result
  if (!isResult(result)) return { kind: 'offline' }
  saveWorkerState(body?.state)
  return { kind: 'checked', result }
}

/** The questions in pairs of indexes, in order; an odd last one comes alone (§5.6 step 3). */
export function pairQuestions(count: number): number[][] {
  const pairs: number[][] = []
  for (let i = 0; i < count; i += 2) pairs.push(i + 1 < count ? [i, i + 1] : [i])
  return pairs
}

/** How many questions still have no choice. */
export function leftToAnswer(count: number, picked: number): number {
  return Math.max(0, count - picked)
}
