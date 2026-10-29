import type { Child } from './api'

const KEY = 'macworx.parentChild'

/** The remembered child if she is still in the list, otherwise the first child, otherwise none. */
export function pickChild(children: Child[], stored: number | null): Child | null {
  return children.find((c) => c.id === stored) ?? children[0] ?? null
}

/** The child chosen in this browser last time. Storage that refuses reads as nothing remembered. */
export function readSelectedChild(): number | null {
  try {
    const value = localStorage.getItem(KEY)
    const id = value === null ? NaN : Number(value)
    return Number.isInteger(id) ? id : null
  } catch {
    return null
  }
}

/** Remembers the choice in this browser. Storage that refuses is ignored. */
export function rememberChild(id: number): void {
  try {
    localStorage.setItem(KEY, String(id))
  } catch {
    // Not remembered; the first child is selected next time.
  }
}
