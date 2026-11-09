import { expect, test, type Page } from '@playwright/test'
import { SPELLING_WORDS } from '../src/practice/samples'

// Spelling practice runs on the iPad alone (SPEC §5.5): no pairing, and nothing is sent.
const WORDS = ['friend', 'because', 'said', 'again', 'people', 'there', 'could', 'where']

async function open(page: Page, api: string[]) {
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/')) api.push(r.url())
  })
  await page.route('/api/**', (route) => route.fulfill({ status: 503, json: { error: 'busy' } }))
  await page.goto('/')
  await page.getByRole('button', { name: 'Start Spelling', exact: true }).click()
}

test('all 8 words check, then Finish and Back to Home, and coming back starts at word 1', async ({
  page,
}) => {
  const api: string[] = []
  await open(page, api)
  const before = api.length
  for (const [i, word] of WORDS.entries()) {
    await expect(page.getByRole('progressbar', { name: `Word ${i + 1} of 8` })).toBeVisible()
    const check = page.getByRole('button', { name: 'Check' })
    await expect(check).toBeDisabled()
    // The right spelling for every other word, the first choice (A) for the rest.
    const choice =
      i % 2 === 0
        ? page.getByRole('radio', { name: new RegExp(`^[A-D] ${word}$`) })
        : page.getByRole('radio').first()
    await choice.click()
    await expect(page.getByText('Ready to check.')).toBeVisible()
    await check.click()
    await expect(page.getByRole('radio', { checked: true })).toHaveAttribute('data-result', /right|not-right/)
    await expect(page.getByRole('radio').first()).toBeDisabled()
    // Next ignores taps for a moment after Check (SPEC §5.1 step 4).
    await expect(page.locator('.practice-buttons button[data-ready]')).toBeVisible()
    await page.getByRole('button', { name: i === 7 ? 'Finish' : 'Next' }).click()
  }
  await expect(page.getByText('You finished all 8 words!').first()).toBeVisible()
  // Back to Home ignores taps for a moment after Finish, like Next (SPEC §5.1 step 4).
  await expect(page.locator('.practice-buttons button[data-ready]')).toBeVisible()
  await page.getByRole('button', { name: 'Back to Home' }).click()
  await expect(page.getByRole('button', { name: 'Start Spelling', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Start Spelling', exact: true }).click()
  await expect(page.getByRole('progressbar', { name: 'Word 1 of 8' })).toBeVisible()
  expect(api.length).toBe(before)
})

test('a wrong choice marks only that choice and names the spelling', async ({ page }) => {
  await open(page, [])
  await page.getByRole('radio', { name: /frend/ }).click()
  await page.getByRole('button', { name: 'Check' }).click()
  await expect(page.getByRole('radio', { name: /frend/ })).toHaveAttribute('data-result', 'not-right')
  await expect(page.locator('[data-result]')).toHaveCount(1)
  await expect(page.locator('.response-equation')).toHaveText('This word is spelled friend.')
})

test('without speech both Play buttons are disabled, a line says why, and she can still choose', async ({
  page,
}) => {
  await page.addInitScript(() => {
    // It is an accessor on Window.prototype, so remove it there as well as on window.
    delete (Window.prototype as unknown as Record<string, unknown>).speechSynthesis
    delete (window as unknown as Record<string, unknown>).speechSynthesis
  })
  await open(page, [])
  await expect(page.getByRole('button', { name: 'Play word', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Hear it in a sentence' })).toBeDisabled()
  await expect(
    page.getByText("This iPad can't play the word. You can still choose a spelling."),
  ).toBeVisible()
  await page.getByRole('radio').first().click()
  await expect(page.getByRole('button', { name: 'Check' })).toBeEnabled()
})

test('the arrow keys move through the choices and pick one, and focus lands on Play word after Next', async ({
  page,
}) => {
  await open(page, [])
  const radios = page.getByRole('radio')
  await radios.first().focus()
  await page.keyboard.press('ArrowDown')
  await expect(radios.nth(1)).toBeFocused()
  await expect(radios.nth(1)).toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('ArrowUp')
  await expect(radios.nth(3)).toBeFocused()
  await expect(radios.nth(3)).toHaveAttribute('aria-checked', 'true')
  await page.getByRole('button', { name: 'Check' }).click()
  await expect(page.locator('.practice-buttons button[data-ready]')).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByRole('progressbar', { name: 'Word 2 of 8' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play word', exact: true })).toBeFocused()
})

test('Play word speaks the word and Hear it in a sentence speaks the sentence, on every word', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const spoken: string[] = []
    ;(window as unknown as { __spoken: string[] }).__spoken = spoken
    class FakeUtterance {
      lang = ''
      rate = 1
      text: string
      constructor(text: string) {
        this.text = text
      }
    }
    ;(window as unknown as Record<string, unknown>).SpeechSynthesisUtterance = FakeUtterance
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { speak: (u: FakeUtterance) => spoken.push(u.text), cancel: () => {}, getVoices: () => [] },
    })
  })
  await open(page, [])
  const spoken = () => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)
  await page.getByRole('button', { name: 'Play word', exact: true }).click()
  await expect.poll(spoken).toEqual([SPELLING_WORDS[0].word])
  await page.getByRole('button', { name: 'Hear it in a sentence' }).click()
  await expect.poll(spoken).toEqual([SPELLING_WORDS[0].word, SPELLING_WORDS[0].sentence])

  await page.getByRole('radio').first().click()
  await page.getByRole('button', { name: 'Check' }).click()
  await expect(page.locator('.practice-buttons button[data-ready]')).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('button', { name: 'Play word', exact: true }).click()
  await expect.poll(async () => (await spoken()).at(-1)).toBe(SPELLING_WORDS[1].word)
})
