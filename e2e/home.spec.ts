import { expect, test, type Page } from '@playwright/test'
import { addDays, generateAssignment } from '../src/engine'
import { fastClock, skipReadyDelay } from './readyDelay'
import { startMath } from './mix'
import { giveSpeech } from './speech'

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
  await giveSpeech(page)
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

/** Answers every problem right and opens the result: with "See how I did", or by leaving with `lastButton`. */
async function finishRight(page: Page, lastButton = 'See how I did') {
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
    await skipReadyDelay(page)
    await expect(page.locator('.pad[data-ready]')).toBeVisible()
    const digits = op === 'multiplication' ? [...String(value)] : [...String(value)].reverse()
    for (const digit of digits) await page.getByRole('button', { name: digit, exact: true }).click()
    await expect(problem).toHaveAttribute('data-shown', String(value))
    await page.getByRole('button', { name: 'Check' }).click()
    // Next ignores taps for a moment after Check.
    await skipReadyDelay(page)
    await expect(page.locator('.practice-buttons button[data-ready]')).toBeVisible()
    await page.getByRole('button', { name: n === 20 ? lastButton : 'Next' }).click()
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

test('Home shows her balance and streak, including results not yet sent', async ({ page }) => {
  const answers = generateAssignment(1).map((p) => p.answer)
  await openApp(page, true, {
    'macworx.state': state(),
    'macworx.queue': [{ seed: 1, day: today(), answers }],
  })
  const progress = page.locator('.home-progress')
  // 100 + 20 + 4 accuracy bonus + 4 streak bonus (streak 3 becomes 4).
  await expect(progress).toContainText('128')
  await expect(progress).toContainText('available to spend')
  await expect(progress).toContainText('4 days')
  await expect(progress).toContainText('Current streak')
  await expect(page.getByText(/assignments? done|Latest:/)).toHaveCount(0)
  await noSidewaysScroll(page)
  await expect(page.getByText('Macaronis start saving soon!')).toHaveCount(0)
})

test('Home takes the Worker numbers when the connection comes back', async ({ page }) => {
  await openApp(page, true, { 'macworx.state': state() })
  const numbers = page.locator('.home-progress')
  await expect(numbers).toContainText('100')

  await page.unroute('/api/**')
  await page.route('/api/**', (route) =>
    route.request().url().endsWith('/api/seeds')
      ? route.fulfill({ json: { seeds: [] } })
      : route.fulfill({ json: state({ balance: 150, completed: 7 }) }),
  )
  await page.evaluate(() => dispatchEvent(new Event('online')))
  await expect(numbers).toContainText('150')
})

test('Home shows no numbers on an iPad that is not paired', async ({ page }) => {
  await openApp(page, false)
  await expect(page.getByRole('button', { name: 'Start Math', exact: true })).toBeVisible()
  await expect(page.locator('.home-balance')).toHaveCount(0)
  await expect(page.getByText('Your Macaronis will show up here.')).toBeVisible()
  await expect(page.getByText(/Current streak/)).toHaveCount(0)
})

const FULL = { tag: '@full-assignment' }
const LANDSCAPE = { tag: '@landscape' }
const PORTRAIT = { tag: '@portrait' }

// Also the check that leaving with Done for now after the 20th answer counts as finishing (the other flows leave
// with See how I did).
test('a paired iPad that has never synced shows no numbers and no streak bonus', FULL, async ({ page }) => {
  test.setTimeout(90_000)
  await fastClock(page)
  await openApp(page, true, { 'macworx.seeds': [21] })
  await expect(page.getByRole('button', { name: 'Start Math', exact: true })).toBeVisible()
  await expect(page.locator('.home-balance')).toHaveCount(0)
  await expect(page.getByText('Your Macaronis will show up here.')).toBeVisible()
  await expect(page.getByText(/Current streak/)).toHaveCount(0)

  await startMath(page)
  await finishRight(page, 'Done for now')
  await expect(page.getByRole('heading', { name: 'Excellent!' })).toBeVisible()
  await expect(page.locator('.result-macaronis')).toHaveText('20 + 4 bonus = 24 Macaronis')
})

// Runs in portrait only: its result line is the widest one the result screen shows, and the result screen has no
// landscape layout of its own, so the upright 820 is the narrower of the two.
test('the streak bonus shows on the first assignment of the day', PORTRAIT, async ({ page }) => {
  test.setTimeout(90_000)
  await fastClock(page)
  await openApp(page, true, { 'macworx.state': state(), 'macworx.seeds': [31] })
  await startMath(page)
  await finishRight(page)
  await expect(page.locator('.result-macaronis')).toHaveText('20 + 4 bonus + 4 streak bonus = 28 Macaronis')
  await expect(page.getByText('Macaronis start saving soon!')).toHaveCount(0)
  await noSidewaysScroll(page)
})

test('the second assignment of the day gets no streak bonus', FULL, async ({ page }) => {
  test.setTimeout(90_000)
  // The first of the day is done and not yet sent: 28 Macaronis, as in the test above.
  const answers = generateAssignment(31).map((p) => p.answer)
  await fastClock(page)
  await openApp(page, true, {
    'macworx.state': state(),
    'macworx.queue': [{ seed: 31, day: today(), answers }],
    'macworx.seeds': [32],
  })
  await expect(page.locator('.home-progress')).toContainText('128')
  await startMath(page)
  await finishRight(page)
  await expect(page.locator('.result-macaronis')).toHaveText('20 + 4 bonus = 24 Macaronis')

  await page.getByRole('button', { name: 'Home' }).click()
  await expect(page.locator('.home-progress')).toContainText('152')
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
  await expect(page.locator('.parent-hero-number')).toHaveText('0')
})

// The practice frame on an assignment (SPEC §5.1, docs/DESIGN-PRACTICE.md §6).
test('an assignment shows her balance and streak in the top bar, the title and the progress', async ({
  page,
}) => {
  await openApp(page, true, { 'macworx.state': state(), 'macworx.seeds': [31] })
  await startMath(page)
  const bar = page.locator('.practice-bar')
  await expect(bar).toContainText('macworx')
  await expect(bar).toContainText('100 Macaronis')
  await expect(bar).toContainText('3 days')
  await expect(page.getByRole('heading', { name: 'A little practice, a little progress.' })).toBeVisible()
  await expect(page.getByText('Problem 1 of 20')).toBeVisible()
  const progress = page.getByRole('progressbar')
  await expect(progress).toHaveAttribute('aria-valuenow', '1')
  await expect(progress).toHaveAttribute('aria-valuemax', '20')
  await expect(page.getByRole('button', { name: 'Done for now' })).toContainText('Practice / Math')
  await noSidewaysScroll(page)
})

test('the top bar shows neither number on an iPad that is not paired', async ({ page }) => {
  await openApp(page, false, { 'macworx.seeds': [31] })
  await startMath(page)
  await expect(page.locator('.practice-bar')).toContainText('macworx')
  await expect(page.locator('.practice-chip')).toHaveCount(0)
})

test('Check sits at the bottom right of the screen', async ({ page }) => {
  await openApp(page, false, { 'macworx.seeds': [31] })
  await startMath(page)
  const box = (await page.getByRole('button', { name: 'Check' }).boundingBox())!
  const view = page.viewportSize()!
  expect(box.x + box.width / 2).toBeGreaterThan(view.width / 2)
  // Portrait scrolls, so only the horizontal side is fixed there; in landscape it is also the lower half.
  if (view.width > view.height) expect(box.y + box.height / 2).toBeGreaterThan(view.height / 2)
})

// Tablets other than the one the layout was drawn on (#201): the Math screen shrinks its number pad to fit and the
// page does not scroll. The keys are 72 in the frame she was drawn on and wherever a landscape row has room, and the
// response stays inside the pad's panel. (In portrait the two stacked panels share the spare height, so the keys
// there are only held to their 48 to 72 range.)
test(
  'the Math screen fits tablets from an iPad mini to an iPad Pro, in both orientations',
  LANDSCAPE,
  async ({ page }) => {
    await openApp(page, false, { 'macworx.seeds': [31] })
    await startMath(page)
    await expect(page.locator('.pad[data-ready]')).toBeVisible()
    // In the landscape project's own 1180x820, the whole practice screen fits with no tolerance at all.
    const own = page.viewportSize()!
    const check = (await page.getByRole('button', { name: 'Check' }).boundingBox())!
    expect(check.y + check.height, 'Check is inside the viewport').toBeLessThanOrEqual(own.height)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight - document.documentElement.clientHeight,
      ),
      'the page does not scroll',
    ).toBeLessThanOrEqual(0)
    // [width, height, whether the keys are the full 72: true, shorter: false, or only within their range: null]
    const sizes: [number, number, boolean | null][] = [
      [744, 1133, null],
      [768, 1024, null],
      [810, 1080, null],
      [834, 1194, true],
      [1133, 744, true],
      [1024, 768, true],
      [1080, 810, true],
      [1194, 834, true],
      [1366, 1024, true],
      // Short enough that the keys give some height back.
      [1024, 706, false],
    ]
    const measure = () =>
      page.evaluate(() => ({
        overflow: document.documentElement.scrollHeight - innerHeight,
        key: document.querySelector('.button-key')?.getBoundingClientRect().height ?? 0,
        inside:
          document.querySelector('.practice-panel-warm')!.getBoundingClientRect().bottom -
          parseFloat(getComputedStyle(document.querySelector('.practice-panel-warm')!).paddingBottom) -
          document.querySelector('.pad, .response')!.getBoundingClientRect().bottom,
      }))
    for (const [width, height, room] of sizes) {
      await page.setViewportSize({ width, height })
      const m = await measure()
      const at = `${width}x${height}`
      // One pixel of rounding is allowed.
      expect(m.overflow, `${at} scrolls`).toBeLessThanOrEqual(1)
      expect(m.key, `${at} keys`).toBeGreaterThanOrEqual(48 - 1)
      expect(m.key, `${at} keys`).toBeLessThanOrEqual(72 + 1)
      if (room === true) expect(m.key, `${at} keys have room for 72`).toBeGreaterThanOrEqual(71)
      if (room === false) expect(m.key, `${at} keys shrink`).toBeLessThan(71)
      expect(m.inside, `${at} pad leaves its panel`).toBeGreaterThanOrEqual(-1)
    }

    // After Check, the response fits the same panel at the smallest sizes.
    const problem = page.locator('.stacked')
    const [a, b, op] = await Promise.all(
      ['data-a', 'data-b', 'data-operation'].map((name) => problem.getAttribute(name)),
    )
    const right =
      op === 'addition'
        ? Number(a) + Number(b)
        : op === 'subtraction'
          ? Number(a) - Number(b)
          : Number(a) * Number(b)
    const digits = op === 'multiplication' ? [...String(right)] : [...String(right)].reverse()
    for (const digit of digits) await page.getByRole('button', { name: digit, exact: true }).click()
    await page.getByRole('button', { name: 'Check' }).click()
    await expect(page.locator('.response-lead')).toBeVisible()
    for (const [width, height] of [
      [744, 1133],
      [1133, 744],
      [1024, 706],
    ]) {
      await page.setViewportSize({ width, height })
      const m = await measure()
      expect(m.overflow, `${width}x${height} scrolls after Check`).toBeLessThanOrEqual(1)
      expect(m.inside, `${width}x${height} response leaves its panel`).toBeGreaterThanOrEqual(-1)
    }
  },
)

// Spelling and Reading on the same tablets (#201): in landscape they take compact sizes on a short viewport and
// do not scroll, before and after Check. (Portrait stacks the panels and scrolls by design.)
test(
  'Spelling and Reading fit landscape tablets from an iPad mini to an iPad Pro, before and after Check',
  LANDSCAPE,
  async ({ page }) => {
    // The safe areas of a landscape iPad (status bar 24, home indicator 20); env() is 0 in the browser.
    await page.route('**/*.css', async (route) => {
      const response = await route.fetch()
      const body = (await response.text())
        .replaceAll('env(safe-area-inset-top)', '24px')
        .replaceAll('env(safe-area-inset-bottom)', '20px')
      await route.fulfill({ response, body })
    })
    await openApp(page, false)
    const sizes = [
      [1133, 744],
      [1024, 768],
      [1080, 810],
      [1180, 820],
      [1194, 834],
      [1366, 1024],
    ]
    const fits = async (at: string) => {
      for (const [width, height] of sizes) {
        await page.setViewportSize({ width, height })
        const overflow = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)
        // One pixel is allowed: Spelling after Check overflows by 1 at 1133x744.
        expect(overflow, `${at} at ${width}x${height} scrolls`).toBeLessThanOrEqual(1)
      }
    }
    const choice = () => page.locator('.word-box').evaluate((el) => el.getBoundingClientRect().height)

    await page.getByRole('button', { name: 'Start Spelling', exact: true }).click()
    await fits('Spelling')
    await page.setViewportSize({ width: 1194, height: 834 })
    expect(await choice(), 'the word box keeps its 78 in the 1194x834 frame').toBeGreaterThanOrEqual(77)
    await page.setViewportSize({ width: 1133, height: 744 })
    expect(await choice(), 'the word box gives height back on a short tablet').toBeLessThan(60)
    await page.getByRole('textbox', { name: 'Type the word' }).fill('frend')
    await page.getByRole('button', { name: 'Check' }).click()
    await fits('Spelling after Check')
    await page.locator('.button-crumb').click()

    await page.getByRole('button', { name: 'Start Reading', exact: true }).click()
    await expect(page.locator('.practice-buttons button[data-ready]')).toBeVisible()
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByRole('progressbar', { name: 'Step 2 of 2 · Questions' })).toBeVisible()
    await fits('Reading questions')
    for (const radiogroup of await page.getByRole('radiogroup').all())
      await radiogroup.getByRole('radio').first().click()
    await page.getByRole('button', { name: 'Check answers' }).click()
    await fits('Reading questions after Check')
  },
)

test(
  'in landscape the Reading passage and questions fit the viewport height, the passage scrolling inside its panel',
  LANDSCAPE,
  async ({ page }) => {
    const view = page.viewportSize()!
    await openApp(page, false)
    await page.getByRole('button', { name: 'Start Reading', exact: true }).click()
    const fits = () =>
      page.evaluate(() => document.documentElement.scrollHeight <= document.documentElement.clientHeight)
    expect(await fits()).toBe(true)
    // Next ignores taps for a moment after the passage opens (SPEC §5.1 step 4).
    await expect(page.locator('.practice-buttons button[data-ready]')).toBeVisible()
    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByRole('progressbar', { name: 'Step 2 of 2 · Questions' })).toBeVisible()
    const read = (await page.getByRole('button', { name: 'Read again' }).boundingBox())!
    expect(read.y + read.height).toBeLessThanOrEqual(view.height)
    expect(await fits()).toBe(true)
  },
)

test('Home shows Math, Spelling and Reading;Spelling and Reading open their practice, and both return to Home without any request; Shop does nothing yet', async ({
  page,
}) => {
  const api: string[] = []
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith('/api/')) api.push(r.url())
  })
  await openApp(page, false)
  for (const name of ['Math', 'Spelling', 'Reading']) {
    await expect(page.getByRole('button', { name: `Start ${name}`, exact: true })).toBeVisible()
  }
  // The shop screen doesn't exist yet (SPEC §5.1 step 1): both Shop controls are there and do nothing.
  for (const shop of [
    page.getByRole('button', { name: 'Shop', exact: true }),
    page.getByRole('button', { name: 'Explore the shop' }),
  ]) {
    await expect(shop).toBeVisible()
    await expect(shop).toHaveAttribute('aria-disabled', 'true')
    await shop.click({ force: true })
  }
  await expect(page).toHaveURL(/\/$/)
  for (const name of ['Spelling', 'Reading']) {
    await page.getByRole('button', { name: `Start ${name}`, exact: true }).click()
    await expect(page.getByRole('button', { name: `Practice  /  ${name}, Back`, exact: true })).toBeVisible()
    if (name === 'Spelling') {
      await expect(page.getByRole('progressbar', { name: 'Word 1 of 8' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Play word', exact: true })).toBeVisible()
      await page.getByRole('textbox', { name: 'Type the word' }).fill('friend')
      await page.getByRole('button', { name: 'Check' }).click()
      await expect(page.getByRole('button', { name: 'Next' })).toBeVisible()
    } else {
      await expect(page.getByRole('progressbar', { name: 'Step 1 of 2 · Read' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Next' })).toBeVisible()
    }
    const before = api.length
    await page.getByRole('button', { name: `Practice  /  ${name}, Back`, exact: true }).click()
    await expect(page.getByRole('button', { name: `Start ${name}`, exact: true })).toBeVisible()
    expect(api.length).toBe(before)
  }
})

// Her progress sits beside the subjects from 768 wide and above them on a phone (SPEC §5.1 step 1). Sets its own viewports.
test(
  'Home is two columns on an iPad, either way up, and one column on a phone',
  LANDSCAPE,
  async ({ page }) => {
    await openApp(page, true, { 'macworx.state': state() })
    const subjects = page.locator('.home-subjects')
    const side = page.locator('.home-side')
    for (const [width, height] of [
      [1180, 820],
      [820, 1180],
    ]) {
      await page.setViewportSize({ width, height })
      const [a, b] = [(await subjects.boundingBox())!, (await side.boundingBox())!]
      expect(b.x).toBeGreaterThan(a.x + a.width - 1)
      expect(Math.abs(a.y - b.y)).toBeLessThan(40)
      await noSidewaysScroll(page)
    }
    await page.setViewportSize({ width: 390, height: 844 })
    const [a, b] = [(await subjects.boundingBox())!, (await side.boundingBox())!]
    expect(b.y + b.height).toBeLessThanOrEqual(a.y + 1)
    await noSidewaysScroll(page)
    await page.setViewportSize({ width: 320, height: 640 })
    await noSidewaysScroll(page)
    await expect(page.getByRole('button', { name: 'Start Math', exact: true })).toBeVisible()
  },
)
