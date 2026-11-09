import { expect, test, type Page } from '@playwright/test'
import { openMix, pickCell, startMath } from './mix'

// The mix screen (SPEC §5.1 step 2) in the production build. The Worker is never reachable here.

const KEY = 'test-device-key-0123456789'

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

async function openApp(page: Page, stored: Record<string, unknown> = {}, paired = false) {
  await page.route('/api/**', (route) => route.fulfill({ status: 503, json: { error: 'busy' } }))
  await page.addInitScript(
    ({ key, items }) => {
      if (key) localStorage.setItem('macworx.deviceKey', key)
      for (const [name, value] of Object.entries(items)) localStorage.setItem(name, JSON.stringify(value))
    },
    { key: paired ? KEY : null, items: stored },
  )
  await page.goto('/')
}

test('picks up to 3 in order, dims the rest, and a pick can be swapped', async ({ page }) => {
  await openApp(page)
  await openMix(page)
  await expect(page.getByText('0 of 3 picked')).toBeVisible()
  await expect(page.getByText('Your next little win.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start 20 problems' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Same as last time' })).toHaveCount(0)
  await expect(page.getByText('Earn up to 24 Macaronis.')).toBeVisible()

  await pickCell(page, 'Multiplication', 'Medium')
  await expect(page.getByText('One at a time.')).toBeVisible()
  await expect(page.getByText('20 problems', { exact: true }).first()).toBeVisible()
  await pickCell(page, 'Division', 'Easy')
  await expect(page.getByText('A little of both.')).toBeVisible()
  await expect(page.getByText('10 problems')).toHaveCount(2)
  await pickCell(page, 'Addition', 'Hard')
  await expect(page.getByText('3 of 3 picked')).toBeVisible()
  await expect(page.getByText('Tap one of your picks to swap it.')).toBeVisible()
  await expect(page.locator('.mix-picks li')).toHaveText([
    /Multiplication\s*Medium\s*7 problems/,
    /Division\s*Easy\s*7 problems/,
    /Addition\s*Hard\s*6 problems/,
  ])

  // Dimmed cells take no taps; a pick unpicks, and the next pick goes last.
  // (Playwright treats aria-disabled as not clickable, so the tap is forced.)
  await page.getByRole('button', { name: /, Subtraction, Easy$/ }).click({ force: true })
  await expect(page.getByText('3 of 3 picked')).toBeVisible()
  await expect(page.getByRole('button', { name: /, Subtraction, Easy$/ })).toHaveAttribute(
    'aria-disabled',
    'true',
  )
  await pickCell(page, 'Division', 'Easy')
  await pickCell(page, 'Subtraction', 'Easy')
  await expect(page.locator('.mix-picks li')).toHaveText([/Multiplication/, /Addition/, /Subtraction/])
  await expect(page.getByRole('button', { name: /, Subtraction, Easy$/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  // Touch targets are at least 44, and the page never scrolls sideways.
  for (const cell of await page.locator('.mix-grid .button').all())
    expect((await cell.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  await noSidewaysScroll(page)
  const start = (await page.getByRole('button', { name: 'Start 20 problems' }).boundingBox())!
  expect(start.x + start.width / 2).toBeGreaterThan(page.viewportSize()!.width / 2)
})

// The rest do not depend on the orientation: they run once per engine.
const ONCE = { tag: '@landscape' }

test('Earn up to follows her streak once the iPad has the Worker numbers', ONCE, async ({ page }) => {
  const yesterday = new Date(Date.now() - 86_400_000)
  const day = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
  await openApp(
    page,
    { 'macworx.state': { balance: 10, streak: 9, lastDay: day, completed: 3, latestGrade: null } },
    true,
  )
  await openMix(page)
  await expect(page.getByText('Earn up to 34 Macaronis.')).toBeVisible()
})

test(
  'the mix is sent with the result, kept for Do another one, and offered as Same as last time',
  ONCE,
  async ({ page }) => {
    await openApp(page, { 'macworx.seeds': [41, 42] }, true)
    await startMath(page, 'Multiplication', 'Easy')
    await expect(page.locator('.stacked')).toHaveAttribute('data-operation', 'multiplication')
    await expect(page.getByText('Multiplication practice')).toBeVisible()
    await expect(page.locator('.pad[data-ready]')).toBeVisible()
    await page.getByRole('button', { name: '1', exact: true }).click()
    await page.getByRole('button', { name: 'Check' }).click()
    await expect(page.locator('.practice-buttons button[data-ready]')).toBeVisible()
    await page.getByRole('button', { name: 'Done for now' }).click()
    await expect(page.getByRole('heading', { name: 'You did 1 problem.' })).toBeVisible()
    const queued = await page.evaluate(() => JSON.parse(localStorage.getItem('macworx.queue') ?? '[]'))
    expect(queued[0].mix).toEqual([{ operation: 'multiplication', level: 'easy' }])

    await page.getByRole('button', { name: 'Do another one' }).click()
    await expect(page.locator('.stacked')).toHaveAttribute('data-operation', 'multiplication')
    await page.getByRole('button', { name: 'Done for now' }).click()

    await openMix(page)
    await page.getByRole('button', { name: 'Same as last time' }).click()
    await expect(page.getByText('1 of 3 picked')).toBeVisible()
    await expect(page.getByRole('button', { name: /, Multiplication, Easy$/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  },
)

test(
  'Do another one with no seeds opens the mix screen with her picks and the Wi-Fi line',
  ONCE,
  async ({ page }) => {
    await openApp(page, { 'macworx.seeds': [41] }, true)
    await startMath(page, 'Division', 'Easy')
    // A division is stacked like a long-division bracket (SPEC §5.1 step 3): the divisor left of the dividend,
    // an answer box over each of its digits, the last box over the ones digit.
    await expect(page.locator('.stacked-division')).toBeVisible()
    const digits = page.locator('.stacked-dividend')
    const boxes = page.locator('.answer-box')
    expect(await boxes.count()).toBe(await digits.count())
    const divisor = (await page.locator('.stacked-divisor').boundingBox())!
    const first = (await digits.first().boundingBox())!
    expect(divisor.x + divisor.width).toBeLessThanOrEqual(first.x + 1)
    const lastBox = (await boxes.last().boundingBox())!
    const lastDigit = (await digits.last().boundingBox())!
    expect(Math.abs(lastBox.x + lastBox.width / 2 - (lastDigit.x + lastDigit.width / 2))).toBeLessThanOrEqual(
      4,
    )
    expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(lastDigit.y + 1)
    await expect(page.locator('.pad[data-ready]')).toBeVisible()
    await page.getByRole('button', { name: '1', exact: true }).click()
    await page.getByRole('button', { name: 'Check' }).click()
    await expect(page.locator('.practice-buttons button[data-ready]')).toBeVisible()
    await page.getByRole('button', { name: 'Done for now' }).click()
    await page.getByRole('button', { name: 'Do another one' }).click()
    await expect(page.getByText('Connect to Wi-Fi to get more problems!')).toBeVisible()
    await expect(page.getByRole('button', { name: /, Division, Easy$/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    // A new pick ends the line, which belonged to the Start before it.
    await pickCell(page, 'Addition', 'Easy')
    await expect(page.getByText('Connect to Wi-Fi to get more problems!')).toHaveCount(0)
  },
)
