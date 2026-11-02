import { expect, test, type Page } from '@playwright/test'

// The parent portal at phone width (SPEC §5.3, docs/DESIGN.md §6.2). Only the phone projects (402×874) run
// this file. The nav is checked as DESIGN §6.2 writes it: a failure here is a layout bug, not a number to loosen.

const TABS = [
  { path: 'overview', label: 'Overview', title: 'A little progress, daily.' },
  { path: 'points', label: 'Macaronis', title: 'Macaronis, kept fair.' },
  { path: 'streak', label: 'Streak', title: 'Make every day count.' },
  { path: 'devices', label: 'Devices', title: "Ada's devices, connected." },
  { path: 'shop', label: 'Shop', title: 'Motivation, made personal.' },
]

/** Answers the portal's reads and the balance write; `posts` collects each write. */
async function api(page: Page) {
  const posts: string[] = []
  let balance = 41
  await page.route('/api/parent/**', (route) => {
    const req = route.request()
    const path = new URL(req.url()).pathname
    if (req.method() === 'POST' && path === '/api/parent/balance') {
      posts.push(path)
      balance += (req.postDataJSON() as { amount: number }).amount
      return route.fulfill({ json: { balance } })
    }
    const answers: Record<string, unknown> = {
      '/api/parent/children': { children: [{ id: 1, name: 'Ada', grade: '4th grade', initials: 'A' }] },
      '/api/parent/summary': {
        balance,
        streak: 3,
        lastDay: '2026-10-16',
        completed: 5,
        earnedToday: 0,
        completedToday: 0,
      },
      '/api/parent/days': { days: ['2026-10-15', '2026-10-16'] },
      '/api/parent/results': { results: [] },
      '/api/parent/log': { entries: [] },
      '/api/parent/devices': { devices: [] },
    }
    return route.fulfill({ json: answers[path] })
  })
  return posts
}

const nav = (page: Page) => page.getByRole('navigation', { name: 'Parent sections' })

// Scrolls to the end of the page, where the bottom padding must leave the last control clear of the bar.
const scrollToEnd = (page: Page) => page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

test('the viewport is phone width', async ({ page }) => {
  expect(page.viewportSize()).toEqual({ width: 402, height: 874 })
})

for (const tab of TABS) {
  test(`${tab.label} tab: layout fits the phone`, async ({ page }) => {
    await api(page)
    await page.goto(`/parent/${tab.path}`)
    await expect(page.getByRole('heading', { level: 1, name: tab.title })).toBeVisible()

    const links = nav(page).getByRole('link')
    await expect(links).toHaveCount(5)
    await expect(nav(page).locator('[aria-current="page"]')).toHaveText(tab.label)
    await expect(nav(page).locator('[aria-current="page"]')).toHaveCount(1)

    await expect(page.locator('.portal-header')).toBeVisible()
    await expect(page.locator('.portal-side')).not.toHaveCSS('position', 'sticky')

    // The bar is flush with the bottom edge, as wide as the screen, and every item is 52 high.
    await expect
      .poll(async () => {
        const bar = (await nav(page).boundingBox())!
        return [Math.round(bar.y + bar.height), Math.round(bar.x), Math.round(bar.width)]
      })
      .toEqual([874, 0, 402])
    for (const link of await links.all()) {
      expect(Math.round((await link.boundingBox())!.height)).toBe(52)
    }

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
}

test('tapping through the five tabs changes the screen without a page load', async ({ page }) => {
  await api(page)
  await page.goto('/parent/overview')
  await expect(page.getByRole('heading', { level: 1, name: TABS[0].title })).toBeVisible()
  let loads = 0
  page.on('load', () => loads++)

  for (const tab of [...TABS.slice(1), TABS[0]]) {
    await nav(page).getByRole('link', { name: tab.label, exact: true }).tap()
    await expect(page.getByRole('heading', { level: 1, name: tab.title })).toBeVisible()
    expect(new URL(page.url()).pathname).toBe(`/parent/${tab.path}`)
    await expect(nav(page).locator('[aria-current="page"]')).toHaveText(tab.label)
  }
  expect(loads).toBe(0)
})

test('adds Macaronis through Review then Confirm at phone width', async ({ page }) => {
  const posts = await api(page)
  await page.goto('/parent/points')
  await expect(page.getByLabel('Macaronis to add')).toBeVisible()

  await page.getByLabel('Macaronis to add').fill('20')
  await page.getByLabel('Reason · required').fill('Homework grades')
  const review = page.getByRole('button', { name: 'Review +20 Macaronis' })
  await scrollToEnd(page)
  const reviewBox = (await review.boundingBox())!
  expect(reviewBox.y + reviewBox.height).toBeLessThanOrEqual((await nav(page).boundingBox())!.y)
  await review.tap()

  // Nothing is saved at Review, and the form is locked.
  expect(posts).toEqual([])
  await expect(page.getByText('Add 20 Macaronis: balance 41 → 61. Reason: Homework grades.')).toBeVisible()
  await expect(page.getByLabel('Macaronis to add')).toBeDisabled()

  const confirm = page.getByRole('button', { name: 'Confirm' })
  await scrollToEnd(page)
  const barTop = (await nav(page).boundingBox())!.y
  const box = (await confirm.boundingBox())!
  expect(box.y + box.height).toBeLessThanOrEqual(barTop)
  await confirm.tap()

  await expect(page.getByText('Saved. Her balance is now 61.')).toBeVisible()
  await expect(page.locator('.points-hero-number')).toHaveText('61')
  expect(posts).toEqual(['/api/parent/balance'])
})
