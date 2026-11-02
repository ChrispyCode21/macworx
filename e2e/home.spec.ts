import { expect, test, type Page } from '@playwright/test'
import { addDays, generateAssignment } from '../src/engine'

// Her numbers on Home and the streak bonus on the result (SPEC §5.1, §6.8). The Worker is never reachable
// here (every /api call answers 503), so what shows is the stored state plus the results not yet sent.

const KEY = 'test-device-key-0123456789'

function today(): string {
  const d = new Date()
  const two = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`
}

/** `paired` stores the device key (plain text); `stored` holds the JSON entries. */
async function openApp(page: Page, paired: boolean, stored: Record<string, unknown> = {}) {
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

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

/** Answers every problem right and opens the result. */
async function finishRight(page: Page) {
  for (let n = 1; n <= 20; n++) {
    const problem = page.locator('.stacked')
    await expect(page.getByText(`Problem ${n} of 20`)).toBeVisible()
    const [a, b, op] = await Promise.all([
      problem.getAttribute('data-a'),
      problem.getAttribute('data-b'),
      problem.getAttribute('data-operation'),
    ])
    const [x, y] = [Number(a), Number(b)]
    const value = op === 'addition' ? x + y : op === 'subtraction' ? x - y : x * y
    await expect(page.locator('.pad[data-ready]')).toBeVisible()
    const digits = op === 'multiplication' ? [...String(value)] : [...String(value)].reverse()
    for (const digit of digits) await page.getByRole('button', { name: digit, exact: true }).click()
    await expect(problem).toHaveAttribute('data-shown', String(value))
    await page.getByRole('button', { name: 'Check' }).click()
    await page.getByRole('button', { name: n === 20 ? 'See how I did' : 'Next' }).click()
  }
}

const state = (over = {}) => ({
  balance: 100,
  streak: 3,
  lastDay: addDays(today(), -1),
  completed: 5,
  latestGrade: 'Good',
  ...over,
})

test('Home shows her four numbers, including results not yet sent', async ({ page }) => {
  const answers = generateAssignment(1).map((p) => p.answer)
  await openApp(page, true, {
    'macworx.state': state(),
    'macworx.queue': [{ seed: 1, day: today(), answers }],
  })
  const numbers = page.locator('.home-numbers')
  // 100 + 20 + 4 accuracy bonus + 4 streak bonus (streak 3 becomes 4).
  await expect(numbers).toContainText('128 Macaronis')
  await expect(numbers).toContainText('6 assignments done')
  await expect(numbers).toContainText('4 day streak')
  await expect(numbers).toContainText('Latest: Excellent')
  await noSidewaysScroll(page)
  await expect(page.getByText('Macaronis start saving soon!')).toHaveCount(0)
})

test('Home takes the Worker numbers when the connection comes back', async ({ page }) => {
  await openApp(page, true, { 'macworx.state': state() })
  const numbers = page.locator('.home-numbers')
  await expect(numbers).toContainText('100 Macaronis')

  await page.unroute('/api/**')
  await page.route('/api/**', (route) =>
    route.request().url().endsWith('/api/seeds')
      ? route.fulfill({ json: { seeds: [] } })
      : route.fulfill({ json: state({ balance: 150, completed: 7 }) }),
  )
  await page.evaluate(() => dispatchEvent(new Event('online')))
  await expect(numbers).toContainText('150 Macaronis')
  await expect(numbers).toContainText('7 assignments done')
})

test('Home shows none of the numbers on an iPad that is not paired', async ({ page }) => {
  await openApp(page, false)
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
  await expect(page.locator('.home-numbers')).toHaveCount(0)
  await expect(page.getByText(/Macaroni/)).toHaveCount(0)
})

const FULL = { tag: '@full-assignment' }

test('a paired iPad that has never synced shows no numbers and no streak bonus', FULL, async ({ page }) => {
  test.setTimeout(90_000)
  await openApp(page, true, { 'macworx.seeds': [21] })
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
  await expect(page.locator('.home-numbers')).toHaveCount(0)
  await expect(page.getByText(/Macaroni/)).toHaveCount(0)

  await page.getByRole('button', { name: 'Start' }).click()
  await finishRight(page)
  await expect(page.locator('.result-macaronis')).toHaveText('20 + 4 bonus = 24 Macaronis')
})

// Runs in both orientations: its result line is the widest one the result screen shows.
test('the streak bonus shows on the first assignment of the day', async ({ page }) => {
  test.setTimeout(90_000)
  await openApp(page, true, { 'macworx.state': state(), 'macworx.seeds': [31] })
  await page.getByRole('button', { name: 'Start' }).click()
  await finishRight(page)
  await expect(page.locator('.result-macaronis')).toHaveText('20 + 4 bonus + 4 streak bonus = 28 Macaronis')
  await expect(page.getByText('Macaronis start saving soon!')).toHaveCount(0)
  await noSidewaysScroll(page)
})

test('the second assignment of the day gets no streak bonus', FULL, async ({ page }) => {
  test.setTimeout(90_000)
  // The first of the day is done and not yet sent: 28 Macaronis, as in the test above.
  const answers = generateAssignment(31).map((p) => p.answer)
  await openApp(page, true, {
    'macworx.state': state(),
    'macworx.queue': [{ seed: 31, day: today(), answers }],
    'macworx.seeds': [32],
  })
  await expect(page.locator('.home-numbers')).toContainText('128 Macaronis')
  await page.getByRole('button', { name: 'Start' }).click()
  await finishRight(page)
  await expect(page.locator('.result-macaronis')).toHaveText('20 + 4 bonus = 24 Macaronis')

  await page.getByRole('button', { name: 'Home' }).click()
  await expect(page.locator('.home-numbers')).toContainText('152 Macaronis')
  await expect(page.locator('.home-numbers')).toContainText('7 assignments done')
})

test('Home shows a Parents link that opens the portal with a full page load', async ({ page }) => {
  await openApp(page, false)
  // Routes added later answer first, so the portal's reads get real answers.
  await page.route('/api/parent/**', (route) => {
    const path = new URL(route.request().url()).pathname
    const child = { id: 1, name: 'Child', grade: '', initials: 'C' }
    const empty = {
      balance: 0,
      streak: 0,
      lastDay: null,
      completed: 0,
      completedToday: 0,
      earnedToday: 0,
      results: [],
      entries: [],
      devices: [],
    }
    return route.fulfill({ json: path === '/api/parent/children' ? { children: [child] } : empty })
  })
  const link = page.getByRole('link', { name: 'Parents' })
  await expect(link).toBeVisible()
  await expect(link).toHaveAttribute('href', '/parent/overview')
  // A document request, not a route inside her app, so Cloudflare Access can ask for a sign-in.
  const documentLoad = page.waitForRequest(
    (req) => req.isNavigationRequest() && new URL(req.url()).pathname === '/parent/overview',
  )
  await link.click()
  await documentLoad
  await expect(page).toHaveURL(/\/parent\/overview$/)
  await expect(page.getByRole('heading', { name: 'A little progress, daily.' })).toBeVisible()
  // The heading shows before the reads answer; her summary showing proves the Overview drew it without throwing.
  await expect(page.locator('.overview-hero-number')).toHaveText('0')
})
