import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { afterDelay, whenReady } from './useReadyAfter'

describe('the ready guard', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('ignores a tap until ready, then lets it through', () => {
    const tap = vi.fn()
    let ready = false
    const stop = afterDelay(() => (ready = true), 350)
    // A quick second tap on Check lands inside the 350 ms and does nothing.
    vi.advanceTimersByTime(300)
    whenReady(ready, tap)()
    expect(tap).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60)
    expect(ready).toBe(true)
    whenReady(ready, tap)()
    expect(tap).toHaveBeenCalledTimes(1)
    stop()
  })

  it('can be cancelled', () => {
    const done = vi.fn()
    afterDelay(done, 350)()
    vi.advanceTimersByTime(1000)
    expect(done).not.toHaveBeenCalled()
  })
})
