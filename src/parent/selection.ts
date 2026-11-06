import type { Child, ParentResult } from './api'

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

/** What the portal knows about the household's children (SPEC §5.3). */
export type ChildrenLoad =
  | { status: 'loading' }
  // The children couldn't be listed; `signedOut` when the sign-in has run out, which Try again can't fix.
  | { status: 'unavailable'; signedOut: boolean }
  | { status: 'none' }
  | { status: 'ready'; children: Child[]; selected: Child }

/** The state a children read leads to; null while the page reloads for a sign-in (show nothing yet). */
export function childrenLoad(
  result: ParentResult<{ children: Child[] }>,
  stored: number | null,
): ChildrenLoad | null {
  if (!result.ok) {
    return result.error === 'reloading'
      ? null
      : { status: 'unavailable', signedOut: result.error === 'signed_out' }
  }
  const selected = pickChild(result.body.children, stored)
  return selected ? { status: 'ready', children: result.body.children, selected } : { status: 'none' }
}
