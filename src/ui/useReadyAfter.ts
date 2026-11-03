import { useEffect, useState } from 'react'

/** How long the action button ignores taps once it reads Next (the number pad uses the same 350 ms). */
export const READY_AFTER_MS = 350

/** Calls `callback` after `ms`; the returned function cancels it. */
export function afterDelay(callback: () => void, ms: number): () => void {
  const timer = setTimeout(callback, ms)
  return () => clearTimeout(timer)
}

/** Runs `action` only once `ready`; a tap before then does nothing. */
export const whenReady = (ready: boolean, action: () => void) => () => {
  if (ready) action()
}

/**
 * False for `ms` after the component mounts, then true. With 0 it is true at once. The action button uses
 * it so a quick double tap on Check can't also tap Next (SPEC §5.1 step 4: nothing moves on by itself).
 */
export function useReadyAfter(ms: number): boolean {
  const [ready, setReady] = useState(ms === 0)
  useEffect(() => (ms === 0 ? undefined : afterDelay(() => setReady(true), ms)), [ms])
  return ready
}
