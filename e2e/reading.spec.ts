import { expect, test, type Page } from '@playwright/test'
import { COPY } from '../src/copy'

// Reading practice runs on the iPad alone (SPEC §5.5): no pairing, and nothing is sent.
const NOTE = 'You can read the passage again.'

async function open(page: Page, api: string[]) {
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/')) api.push(r.url())
  })
  await page.route('/api/**', (route) => route.fulfill({ status: 503, json: { error: 'busy' } }))
  await page.goto('/')
  await page.getByRole('button', { name: 'Start Reading', exact: true }).click()
}

const ready = (page: Page) => expect(page.locator('.practice-buttons button[data-ready]')).toBeVisible()
const card = (page: Page, n: number) => page.locator('.practice-question-card').nth(n)

test('read, answer, check, finish, and Read again keeps her choices before and after Check', async ({
  page,
}) => {
  const api: string[] = []
  await open(page, api)
  const before = api.length
  await expect(page.getByRole('progressbar', { name: 'Step 1 of 2 · Read' })).toBeVisible()
  await expect(page.getByText('Lorem ipsum dolor sit amet, consectetur')).toBeVisible()
  await expect(page.locator('img')).toHaveCount(0)
  await ready(page)
  await page.getByRole('button', { name: 'Next' }).click()

  await expect(page.getByRole('progressbar', { name: 'Step 2 of 2 · Questions' })).toBeVisible()
  await expect(page.getByRole('radio').first()).toBeFocused()
  const check = page.getByRole('button', { name: 'Check answers' })
  await expect(check).toBeDisabled()
  await expect(page.getByText(NOTE, { exact: true })).toBeVisible()
  await card(page, 0).getByRole('radio', { name: /^B / }).click()
  await expect(check).toBeDisabled()
  await expect(page.getByText(`1 answer chosen. ${NOTE}`)).toBeVisible()
  await card(page, 1).getByRole('radio', { name: /^B / }).click()
  await expect(check).toBeEnabled()
  await expect(page.getByText(`2 answers chosen. ${NOTE}`)).toBeVisible()

  // Read again keeps both choices, before Check.
  await page.getByRole('button', { name: 'Read again' }).click()
  await expect(page.getByRole('progressbar', { name: 'Step 1 of 2 · Read' })).toBeVisible()
  await ready(page)
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(card(page, 0).getByRole('radio', { name: /^B / })).toHaveAttribute('aria-checked', 'true')
  await expect(card(page, 1).getByRole('radio', { name: /^B / })).toHaveAttribute('aria-checked', 'true')

  // Q1 B is right, Q2 B is not (A is).
  await ready(page)
  await check.click()
  await expect(card(page, 0).getByRole('radio', { name: /^B / })).toHaveAttribute('data-result', 'right')
  await expect(card(page, 0).locator('.response-lead')).toHaveText(COPY.cheers[0])
  await expect(card(page, 1).getByRole('radio', { name: /^B / })).toHaveAttribute('data-result', 'not-right')
  await expect(card(page, 1).locator('.response-equation')).toHaveText('The best answer is A.')
  await expect(card(page, 1).getByRole('radio', { name: /^A / })).not.toHaveAttribute('data-result', /.*/)
  await expect(page.locator('[data-result]')).toHaveCount(2)
  await expect(page.getByRole('radio').first()).toBeDisabled()

  // Read again keeps the results after Check.
  await page.getByRole('button', { name: 'Read again' }).click()
  await expect(page.getByRole('progressbar', { name: 'Step 1 of 2 · Read' })).toBeVisible()
  await ready(page)
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.locator('[data-result]')).toHaveCount(2)
  await expect(card(page, 1).locator('.response-equation')).toHaveText('The best answer is A.')

  await ready(page)
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByText('You finished the passage and its questions!').first()).toBeVisible()
  await ready(page)
  await page.getByRole('button', { name: 'Back to Home' }).click()
  await expect(page.getByRole('button', { name: 'Start Reading', exact: true })).toBeVisible()
  expect(api.length).toBe(before)
})

test('it works offline once loaded', async ({ page, context }) => {
  await open(page, [])
  await context.setOffline(true)
  await ready(page)
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('radio').first().click()
  await expect(page.getByText(`1 answer chosen. ${NOTE}`)).toBeVisible()
})

test('leaving mid-way keeps nothing: reopening starts at the passage with no choices', async ({ page }) => {
  await open(page, [])
  await ready(page)
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByRole('radio').first().click()
  await page.getByRole('button', { name: 'Practice  /  Reading, Back', exact: true }).click()
  await page.getByRole('button', { name: 'Start Reading', exact: true }).click()
  await expect(page.getByRole('progressbar', { name: 'Step 1 of 2 · Read' })).toBeVisible()
  await ready(page)
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.locator('[aria-checked="true"]')).toHaveCount(0)
})

test('the arrow keys pick within one card and never move into the other', async ({ page }) => {
  await open(page, [])
  await ready(page)
  await page.getByRole('button', { name: 'Next' }).click()
  const radios = card(page, 0).getByRole('radio')
  await radios.first().focus()
  await page.keyboard.press('ArrowDown')
  await expect(radios.nth(1)).toBeFocused()
  await expect(radios.nth(1)).toHaveAttribute('aria-checked', 'true')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('ArrowDown')
  await expect(radios.first()).toBeFocused()
  await expect(radios.first()).toHaveAttribute('aria-checked', 'true')
  await expect(card(page, 1).locator('[aria-checked="true"]')).toHaveCount(0)
})

test('a double tap on Next does not also check her answers', async ({ page }) => {
  await open(page, [])
  await ready(page)
  await page.getByRole('button', { name: 'Next' }).click()
  await card(page, 0).getByRole('radio').first().click()
  await card(page, 1).getByRole('radio').first().click()
  await page.getByRole('button', { name: 'Read again' }).click()
  await ready(page)
  // The second tap lands on Check answers just as it appears, before it is ready.
  await page.getByRole('button', { name: 'Next' }).dblclick()
  await expect(page.getByRole('button', { name: 'Check answers' })).toBeEnabled()
  await expect(page.locator('[data-result]')).toHaveCount(0)
})
