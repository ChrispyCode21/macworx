// The iPad's own storage (SPEC §2, §5.4, §6.8): its device key, unused seeds, the results it hasn't sent
// yet, and the Worker's latest state. Storage can be missing or refuse writes (private mode, quota); the key
// then reads as "not paired", and a list that can't be read reads as empty.

const KEY = 'macworx.deviceKey'
const SEEDS = 'macworx.seeds'
const QUEUE = 'macworx.queue'
const STATE = 'macworx.state'

/** A result waiting to be sent to `POST /api/results`. */
export interface QueuedResult {
  seed: number
  day: string
  answers: number[]
}

/** Her numbers as the Worker last returned them (`GET /api/state`, SPEC §8). */
export interface WorkerState {
  balance: number
  streak: number
  lastDay: string | null
  completed: number
  latestGrade: string | null
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

function read<T>(key: string, valid: (value: unknown) => value is T): T | null {
  try {
    const value: unknown = JSON.parse(storage()?.getItem(key) ?? 'null')
    return valid(value) ? value : null
  } catch {
    return null
  }
}

function write(key: string, value: unknown): void {
  try {
    storage()?.setItem(key, JSON.stringify(value))
  } catch {
    // Storage refused it. Nothing else can be done here.
  }
}

const isSeed = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0
const isQueued = (r: unknown): r is QueuedResult => {
  const { seed, day, answers } = (r ?? {}) as Partial<QueuedResult>
  return isSeed(seed) && typeof day === 'string' && Array.isArray(answers) && answers.every(Number.isInteger)
}
/** Keeps the items it can read, so one it can't never takes the rest with it. */
const readList = <T>(key: string, item: (v: unknown) => v is T): T[] =>
  (read(key, Array.isArray) ?? []).filter(item)
const isState = (v: unknown): v is WorkerState =>
  typeof v === 'object' && v !== null && typeof (v as WorkerState).balance === 'number'

export function getDeviceKey(): string | null {
  try {
    return storage()?.getItem(KEY) ?? null
  } catch {
    return null
  }
}

/** Stores the key; false if this iPad's storage is missing or refused it. */
export function setDeviceKey(key: string): boolean {
  try {
    const s = storage()
    if (!s) return false
    s.setItem(KEY, key)
    return s.getItem(KEY) === key
  } catch {
    return false
  }
}

/** Forgets the key and everything stored for it: an unpaired iPad's results aren't saved (SPEC §6.9). */
export function forgetDeviceKey(): void {
  try {
    for (const key of [KEY, SEEDS, QUEUE, STATE]) storage()?.removeItem(key)
  } catch {
    // Nothing stored, nothing to forget.
  }
}

export const getSeeds = (): number[] => readList(SEEDS, isSeed)
export const setSeeds = (seeds: number[]): void => write(SEEDS, seeds)

export const getQueue = (): QueuedResult[] => readList(QUEUE, isQueued)
export const queueResult = (result: QueuedResult): void => write(QUEUE, [...getQueue(), result])
/** Removes by seed, never by position, so a result queued meanwhile stays. */
export const dropQueued = (seed: number): void =>
  write(
    QUEUE,
    getQueue().filter((r) => r.seed !== seed),
  )

export const getWorkerState = (): WorkerState | null => read(STATE, isState)
export const setWorkerState = (state: WorkerState): void => write(STATE, state)

/** Asks the browser not to clear this storage under pressure (SPEC §6.8). */
export function requestPersistence(): void {
  globalThis.navigator?.storage?.persist?.().catch(() => {})
}

/** Whether the app runs installed from the home screen, not in a Safari tab (SPEC §5.4). */
export function isInstalled(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || globalThis.matchMedia?.('(display-mode: standalone)').matches === true
}

/** Whether Home offers Pair: in the installed app, or in a PR preview build, which is opened in a browser tab (SPEC §5.4). */
export const canPair = (preview: boolean = import.meta.env.VITE_PREVIEW === '1'): boolean =>
  preview || isInstalled()
