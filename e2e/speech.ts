import type { Page } from '@playwright/test'

/**
 * Gives the page a silent speechSynthesis when the browser has none (the WebKit build Playwright runs on some
 * machines), because Spelling won't open on an iPad that can't speak (SPEC §5.7 step 2). A real one is left alone.
 */
export async function giveSpeech(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if ('speechSynthesis' in window) return
    class Utterance {
      text: string
      constructor(text: string) {
        this.text = text
      }
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, value: Utterance })
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { speak: () => {}, cancel: () => {}, getVoices: () => [] },
    })
  })
}
