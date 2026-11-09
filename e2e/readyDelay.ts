import type { Page } from '@playwright/test'

// The number pad and the Next button ignore taps for 350 ms after they appear (src/ui/useReadyAfter.ts), twice
// per problem. Flows that tap through a whole assignment test flow and payout, not that delay (the tests of the
// delay itself run on the real clock), so they jump past it. Call `fastClock` before `page.goto`.
export async function fastClock(page: Page) {
  await page.clock.install()
  // Time keeps flowing as usual; `skipReadyDelay` only adds a jump on top.
  await page.clock.resume()
}

/** Jumps past the ready delay of whatever just appeared. */
export async function skipReadyDelay(page: Page) {
  await page.clock.fastForward(400)
}
