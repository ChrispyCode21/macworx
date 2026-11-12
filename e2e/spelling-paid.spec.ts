import { expect, test, type Page } from '@playwright/test'
import { giveSpeech } from './speech'

// A paid spelling assignment on a paired iPad (SPEC §5.7), with the Worker mocked.
const KEY = 'test-device-key-0123456789'
const words = [
  { id: 4, word: 'friend', sentence: 'My friend came.', alternates: [] },
  { id: 9, word: 'colour', sentence: '', alternates: ['color'] },
]
const state = { balance: 125, streak: 1, lastDay: '2026-11-09', completed: 1, latestGrade: 'Great' }
const result = {
  attempt: 9,
  day: '2026-11-09',
  answered: 2,
  correct: 1,
  finished: true,
  grade: 'Good',
  payout: { base: 1, accuracyBonus: 0, streakBonus: 5, total: 6 },
  words: [],
}

type Answer = 'ok' | 'offline' | 'voided'

async function pair(page: Page, onResult: (n: number) => Answer) {
  const posted: unknown[] = []
  const api: string[] = []
  page.on('request', (r) => {
    const path = new URL(r.url()).pathname
    if (path.startsWith('/api/')) api.push(path)
  })
  await page.route('/api/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/spelling/start') return route.fulfill({ json: { attempt: 9, words } })
    if (path === '/api/spelling/result') {
      posted.push(route.request().postDataJSON())
      const answer = onResult(posted.length)
      if (answer === 'offline') return route.abort()
      if (answer === 'voided') return route.fulfill({ status: 404, json: { error: 'not_found' } })
      return route.fulfill({ status: 201, json: { result, state } })
    }
    if (path === '/api/seeds') return route.fulfill({ json: { seeds: [] } })
    return route.fulfill({ json: state })
  })
  await page.addInitScript((key) => localStorage.setItem('macworx.deviceKey', key), KEY)
  await page.goto('/')
  return { posted, api }
}

const box = (page: Page) => page.getByRole('textbox', { name: 'Type the word' })
const ready = (page: Page) =>
  expect(page.locator('.practice-buttons button[data-ready]').last()).toBeVisible()
const start = (page: Page) => page.getByRole('button', { name: 'Start Spelling', exact: true }).click()

async function typeWord(page: Page, typed: string, button: string) {
  await box(page).fill(typed)
  await page.getByRole('button', { name: 'Check' }).click()
  await ready(page)
  await page.getByRole('button', { name: button, exact: true }).click()
}

test('types the Worker’s words, retries Finish after Wi-Fi drops, and sees the Worker’s result', async ({
  page,
}) => {
  await giveSpeech(page)
  const { posted, api } = await pair(page, (n) => (n === 1 ? 'offline' : 'ok'))
  await start(page)
  await expect(page.getByRole('progressbar', { name: 'Word 1 of 2' })).toBeVisible()

  await typeWord(page, 'frend', 'Next')
  await expect(page.getByRole('progressbar', { name: 'Word 2 of 2' })).toBeVisible()
  await typeWord(page, 'color', 'Finish')

  // No connection: her typing stays and Finish is still there.
  await expect(page.getByText('Connect to Wi-Fi, then tap Finish again.').first()).toBeVisible()
  await expect(box(page)).toHaveValue('color')
  await page.getByRole('button', { name: 'Finish', exact: true }).click()
  await expect(page.getByText('You got 1 of 2 words right!').first()).toBeVisible()
  await ready(page)
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Home', exact: true })).toBeVisible()

  // Both tries sent the same attempt and the same typing, by word id, and start was asked for once.
  const sent = {
    attempt: 9,
    answers: [
      { word: 4, typed: 'frend' },
      { word: 9, typed: 'color' },
    ],
  }
  expect(posted).toHaveLength(2)
  for (const body of posted) expect(body).toMatchObject(sent)
  expect(api.filter((p) => p === '/api/spelling/start')).toHaveLength(1)
})

test('words a parent changed: nothing is recorded and she goes back to Home', async ({ page }) => {
  await giveSpeech(page)
  await pair(page, () => 'voided')
  await start(page)
  await typeWord(page, 'friend', 'Next')
  await typeWord(page, 'colour', 'Finish')
  await expect(page.getByText('Your words changed!').first()).toBeVisible()
  await ready(page)
  await page.getByRole('button', { name: 'Back to Home' }).click()
  await expect(page.getByRole('button', { name: 'Start Spelling', exact: true })).toBeVisible()
})

test('no speech: nothing starts and no spelling request is made, even paired', async ({ page }) => {
  await page.addInitScript(() => {
    // It is an accessor on Window.prototype, so remove it there as well as on window.
    delete (Window.prototype as unknown as Record<string, unknown>).speechSynthesis
    delete (window as unknown as Record<string, unknown>).speechSynthesis
  })
  const { api } = await pair(page, () => 'ok')
  await start(page)
  await expect(page.getByText("This iPad can't say words out loud.")).toBeVisible()
  expect(api.filter((p) => p.startsWith('/api/spelling'))).toHaveLength(0)
})
