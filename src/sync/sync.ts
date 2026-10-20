// Saving her results (SPEC §6.8): sends the results this iPad hasn't sent yet, oldest first, then tops up
// its seeds and its copy of the Worker's state. One sync runs at a time.
import {
  dropQueued,
  forgetDeviceKey,
  getDeviceKey,
  getQueue,
  getSeeds,
  queueResult,
  setSeeds,
  setWorkerState,
  type WorkerState,
} from '../storage/device'

export type SyncOutcome = 'done' | 'offline' | 'unpaired'

/** The seed she's working on, and the key it came with. Kept in memory: a closed app has nothing to resume. */
let inProgress: { seed: number; key: string } | null = null
let running: Promise<SyncOutcome> | null = null
let again = false

/** The iPad's own calendar day; the Worker moves a day that's out of range (§6.8). */
export function localDay(date: Date): string {
  const two = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`
}

/** The next stored seed for a paired iPad, or null when there's none. */
export function takeSeed(): number | null {
  const key = getDeviceKey()
  const [seed, ...rest] = getSeeds()
  if (!key || seed === undefined) return null
  setSeeds(rest)
  inProgress = { seed, key }
  return seed
}

/**
 * She's done with `seed`: answers go in the queue and are sent; with no answers the seed goes to the back.
 * Does nothing for a seed that wasn't taken, or when the iPad was unpaired meanwhile.
 */
export function endSeed(seed: number, answers: number[], now: Date): void {
  const started = inProgress
  inProgress = null
  if (started?.seed !== seed || getDeviceKey() !== started.key) return
  if (answers.length === 0) {
    setSeeds([...getSeeds().filter((s) => s !== seed), seed])
    return
  }
  queueResult({ seed, day: localDay(now), answers })
  void sync()
}

/** Runs a sync, or joins the one running (which then runs once more, for anything queued meanwhile). */
export function sync(): Promise<SyncOutcome> {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    let outcome: SyncOutcome
    do {
      again = false
      outcome = await syncOnce()
    } while (again && outcome !== 'unpaired')
    return outcome
  })().finally(() => {
    running = null
  })
  return running
}

const TIMEOUT_MS = 10_000

async function syncOnce(): Promise<SyncOutcome> {
  const key = getDeviceKey()
  if (!key) return 'done'

  const call = async (method: string, path: string, body?: unknown) => {
    try {
      return await fetch(path, {
        method,
        headers: {
          Authorization: `Bearer ${key}`,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout?.(TIMEOUT_MS),
      })
    } catch {
      return null
    }
  }
  // A 401 means a parent unpaired this iPad: its key and everything stored for it go (§6.9).
  const unpaired = (response: Response) => {
    if (response.status === 401 && getDeviceKey() === key) forgetDeviceKey()
    return getDeviceKey() !== key
  }
  const readBody = async (response: Response) =>
    (await response.json().catch(() => null)) as Record<string, unknown> | null
  const saveState = (state: unknown) => {
    if (typeof state !== 'object' || state === null) return
    const { balance, streak, lastDay, completed, latestGrade } = state as WorkerState
    if (typeof balance === 'number') setWorkerState({ balance, streak, lastDay, completed, latestGrade })
  }

  // Oldest first. One the Worker can't take right now holds the rest back, but seeds still top up.
  let held = false
  for (let next = getQueue()[0]; next; next = getQueue()[0]) {
    const response = await call('POST', '/api/results', next)
    if (!response) return 'offline'
    if (unpaired(response)) return 'unpaired'
    const body = await readBody(response)
    // Refused as not valid: it can never be recorded, so it mustn't hold up the rest (§6.8).
    if (body?.error === 'bad_result' || body?.error === 'unknown_seed') {
      dropQueued(next.seed)
      continue
    }
    if (!response.ok || !body?.result) {
      held = true
      break
    }
    saveState(body.state)
    dropQueued(next.seed)
  }

  const seedsResponse = await call('POST', '/api/seeds')
  if (!seedsResponse) return 'offline'
  if (unpaired(seedsResponse)) return 'unpaired'
  const offered = seedsResponse.ok ? (await readBody(seedsResponse))?.seeds : null
  if (Array.isArray(offered)) {
    // Read again now: she may have started or finished an assignment while the request was out.
    const taken = new Set(getQueue().map((r) => r.seed))
    if (inProgress) taken.add(inProgress.seed)
    const stored = getSeeds().filter((s) => offered.includes(s))
    const added = offered.filter((s): s is number => Number.isInteger(s) && !stored.includes(s))
    setSeeds([...stored, ...added].filter((s) => !taken.has(s)))
  }

  const stateResponse = await call('GET', '/api/state')
  if (!stateResponse) return 'offline'
  if (unpaired(stateResponse)) return 'unpaired'
  if (stateResponse.ok) saveState(await readBody(stateResponse))
  return held || !seedsResponse.ok || !stateResponse.ok ? 'offline' : 'done'
}
