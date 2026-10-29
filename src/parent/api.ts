// The parent page's calls (SPEC §5.3, §6.9). Cloudflare Access guards /api/parent: when its session has
// run out, a call gets a redirect to sign in instead of an answer. The page then reloads /parent once, so
// Access can ask the parent to sign in again. A JSON answer is the Worker's own and never reloads (it's
// what a preview, which has no Access, always gets), so a refusal there can't loop.

import { pickChild, readSelectedChild } from './selection'

const RELOADED = 'macworx.parentReloaded'

/** The one-reload flag. Storage that refuses reads as "already reloaded", so it can never loop. */
function flag(op: 'get' | 'set' | 'clear'): boolean {
  try {
    if (op === 'get') return sessionStorage.getItem(RELOADED) !== null
    if (op === 'set') sessionStorage.setItem(RELOADED, '1')
    else sessionStorage.removeItem(RELOADED)
    return true
  } catch {
    return true
  }
}

export type ParentResult<T> = { ok: true; body: T } | { ok: false; status: number; error: string }

export async function parentCall<T>(path: string, init: RequestInit = {}): Promise<ParentResult<T>> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      redirect: 'manual',
      headers: { 'Content-Type': 'application/json', ...init.headers },
    })
  } catch {
    return { ok: false, status: 0, error: 'offline' }
  }
  const body = response.type === 'opaqueredirect' ? null : await response.json().catch(() => null)
  if (body === null) {
    // Cloudflare's own error pages (5xx) aren't a sign-in: say so, don't reload.
    if (response.status >= 500) return { ok: false, status: response.status, error: 'server' }
    if (!flag('get')) {
      flag('set')
      location.reload()
      return { ok: false, status: response.status, error: 'reloading' }
    }
    return { ok: false, status: response.status, error: 'signed_out' }
  }
  flag('clear')
  return response.ok
    ? { ok: true, body: body as T }
    : { ok: false, status: response.status, error: String((body as { error?: unknown }).error ?? 'server') }
}

export interface Device {
  id: number
  label: string
  createdAt: string
  revokedAt: string | null
}

export interface Summary {
  balance: number
  streak: number
  lastDay: string | null
  completed: number
}

export interface ResultRow {
  id: number
  day: string
  answered: number
  correct: number
  finished: boolean
  grade: string | null
  total: number
}

export interface LogEntry {
  id: number
  at: string
  email: string
  action: string
  detail: Record<string, unknown>
}

/** How many results and log entries the Worker sends (SPEC §5.3). */
export const LIST_LIMIT = 50

/** The longest note the Worker accepts on an adjustment (SPEC §5.3). */
export const MAX_NOTE = 200

export interface Child {
  id: number
  name: string
  grade: string
  initials: string
}

/** The child every call below is for (SPEC §8: the `child` query parameter). */
let selected: number | null = null

export const chooseChild = (id: number | null) => {
  selected = id
}

export const getChildren = () => parentCall<{ children: Child[] }>('/api/parent/children')

/**
 * A call for the selected child. With none chosen yet, the first child is chosen (SPEC §5.3); a failure to
 * list the children, or a household with none, comes back as the call's own failure.
 */
async function scoped<T>(path: string, init?: RequestInit): Promise<ParentResult<T>> {
  if (selected === null) {
    const found = await getChildren()
    if (!found.ok) return found
    // The remembered child when there is one, else the first (SPEC §5.3).
    const picked = pickChild(found.body.children, readSelectedChild())
    if (!picked) return { ok: false, status: 404, error: 'no_child' }
    selected = picked.id
  }
  return parentCall<T>(`${path}?child=${selected}`, init)
}

export const getSummary = () => scoped<Summary>('/api/parent/summary')

export const listResults = () => scoped<{ results: ResultRow[] }>('/api/parent/results')

export const listLog = () => scoped<{ entries: LogEntry[] }>('/api/parent/log')

export const listDevices = () => scoped<{ devices: Device[] }>('/api/parent/devices')

export const unpair = (id: number) => scoped<{ ok: true }>(`/api/parent/devices/${id}`, { method: 'DELETE' })

export const setStreak = (streak: number, lastDay: string | null) =>
  scoped<Summary>('/api/parent/streak', { method: 'POST', body: JSON.stringify({ streak, lastDay }) })

export const adjustBalance = (amount: number, note: string) =>
  scoped<{ balance: number }>('/api/parent/balance', {
    method: 'POST',
    body: JSON.stringify({ amount, note }),
  })

export const makeCode = (name: string) =>
  scoped<{ code: string; expiresAt: string }>('/api/parent/pairing-code', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
