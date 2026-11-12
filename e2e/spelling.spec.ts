import { expect, test, type Page } from '@playwright/test'
import { SPELLING_WORDS } from '../src/practice/samples'
import { giveSpeech } from './speech'

// The Spelling sample runs on the iPad alone (SPEC §5.5): no pairing, and nothing is sent. She hears the word
// (the browsers here have speech synthesis) and types it.
const WORDS = SPELLING_WORDS.map((w) => w.word)

async function open(page: Page, api: string[], speech = true) {
  if (speech) await giveSpeech(page)
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/')) api.push(r.url())
  })
  await page.route('/api/**', (route) => route.fulfill({ status: 503, json: { error: 'busy' } }))
  await page.goto('/')
  await page.getByRole('button', { name: 'Start Spelling', exact: true }).click()
}

const box = (page: Page) => page.getByRole('textbox', { name: 'Type the word' })

test('all 8 words are typed and checked, then Finish and Back to Home, and coming back starts at word 1', async ({
  page,
}) => {
  const api: string[] = []
  await open(page, api)
  const before = api.length
  for (const [i, word] of WORDS.entries()) {
    await expect(page.getByRole('progressbar', { name: `Word ${i + 1} of 8` })).toBeVisible()
    const check = page.getByRole('button', { name: 'Check' })
    await expect(check).toBeDisabled()
    // The word with capitals and spaces for every other word (still right), a wrong spelling for the rest.
    await box(page).fill(i % 2 === 0 ? `  ${word.toUpperCase()} ` : `${word}x`)
    await expect(page.getByText('Ready to check.')).toBeVisible()
    await check.click()
    await expect(box(page)).toHaveAttribute('data-result', i % 2 === 0 ? 'right' : 'not-right')
    await expect(box(page)).toHaveAttribute('readonly', '')
    if (i % 2 === 1)
      await expect(page.locator('.response-equation')).toHaveText(`This word is spelled ${word}.`)
    // Next ignores taps for a moment after Check (SPEC §5.1 step 4).
    await expect(page.locator('.practice-buttons button[data-ready]')).toBeVisible()
    await page.getByRole('button', { name: i === 7 ? 'Finish' : 'Next' }).click()
  }
  await expect(page.getByText('You finished all 8 words!').first()).toBeVisible()
  await expect(page.locator('.practice-buttons button[data-ready]')).toBeVisible()
  await page.getByRole('button', { name: 'Back to Home' }).click()
  await expect(page.getByRole('button', { name: 'Start Spelling', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Start Spelling', exact: true }).click()
  await expect(page.getByRole('progressbar', { name: 'Word 1 of 8' })).toBeVisible()
  expect(api.length).toBe(before)
})

test('Enter checks the word, and the box turns off autocorrect, capitals and spell check', async ({
  page,
}) => {
  await open(page, [])
  await expect(box(page)).toHaveAttribute('autocorrect', 'off')
  await expect(box(page)).toHaveAttribute('autocapitalize', 'off')
  await expect(box(page)).toHaveAttribute('spellcheck', 'false')
  await box(page).fill('frend')
  await box(page).press('Enter')
  await expect(box(page)).toHaveAttribute('data-result', 'not-right')
  await expect(page.locator('.response-equation')).toHaveText('This word is spelled friend.')
})

test('the box takes 100 characters at most', async ({ page }) => {
  await open(page, [])
  await box(page).fill('x'.repeat(150))
  await expect(box(page)).toHaveValue('x'.repeat(100))
})

test('without speech Spelling starts nothing: Home says why and no request is made', async ({ page }) => {
  await page.addInitScript(() => {
    // It is an accessor on Window.prototype, so remove it there as well as on window.
    delete (Window.prototype as unknown as Record<string, unknown>).speechSynthesis
    delete (window as unknown as Record<string, unknown>).speechSynthesis
  })
  const api: string[] = []
  await open(page, api, false)
  const before = api.length
  await expect(page.getByText("This iPad can't say words out loud.")).toBeVisible()
  await expect(page.getByRole('progressbar')).toHaveCount(0)
  expect(api.length).toBe(before)
})

test('Play word says the word then its sentence, on every word', async ({ page }) => {
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
  await expect.poll(spoken).toEqual([SPELLING_WORDS[0].word, SPELLING_WORDS[0].sentence])

  await box(page).fill('friend')
  await page.getByRole('button', { name: 'Check' }).click()
  await expect(page.locator('.practice-buttons button[data-ready]')).toBeVisible()
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByRole('button', { name: 'Play word', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Play word', exact: true }).click()
  await expect
    .poll(async () => (await spoken()).slice(-2))
    .toEqual([SPELLING_WORDS[1].word, SPELLING_WORDS[1].sentence])
})
