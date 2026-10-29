import { expect, test, type Page } from '@playwright/test'

// The parent portal's shell (SPEC §5.3): five tabs at their own addresses, the phone and wide layouts, and the
// child switcher. /api/parent is answered by the test. The Playwright projects are both wide (820 and 1180);
// phone widths set their own viewport.

const children = [
  { id: 1, name: 'Ada', grade: '4th grade', initials: 'A' },
  { id: 2, name: 'Bo', grade: '', initials: 'B' },
]

const TABS = [
  { path: 'overview', label: 'Overview', title: 'A little progress, daily.' },
  { path: 'points', label: 'Macaronis', title: 'Macaronis, kept fair.' },
  { path: 'streak', label: 'Streak', title: 'Make every day count.' },
  { path: 'devices', label: 'Devices', title: "Ada's devices, connected." },
  { path: 'shop', label: 'Shop', title: 'Motivation, made personal.' },
]

const READS = ['summary', 'results', 'devices', 'log']

/** Answers every read; `calls` holds each one as `/api/parent/summary?child=1`. */
async function portalApi(page: Page) {
  const calls: string[] = []
  await page.route('/api/parent/**', (route) => {
    const url = new URL(route.request().url())
    calls.push(url.pathname + url.search)
    const answers: Record<string, unknown> = {
      '/api/parent/children': { children },
      '/api/parent/summary': { balance: 41, streak: 3, lastDay: '2026-10-16', completed: 5 },
      '/api/parent/results': { results: [] },
      '/api/parent/log': { entries: [] },
      '/api/parent/devices': { devices: [] },
    }
    return route.fulfill({ json: answers[url.pathname] })
  })
  return calls
}

const nav = (page: Page) => page.getByRole('navigation', { name: 'Parent sections' })
const current = (page: Page) => nav(page).locator('[aria-current="page"]')
const reads = (calls: string[], name: string) => calls.filter((c) => c.startsWith(`/api/parent/${name}`))

test('every tab opens directly, with its title and one current link', async ({ page }) => {
  await portalApi(page)
  for (const tab of TABS) {
    await page.goto(`/parent/${tab.path}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(tab.title)
    await expect(current(page)).toHaveCount(1)
    await expect(current(page)).toHaveText(tab.label)
    await expect(nav(page).getByRole('link')).toHaveCount(5)
  }
  // Shop has no screen of its own yet: only the shell.
  await expect(page.locator('.parent-section')).toHaveCount(0)
})

test('/parent and unknown addresses show Overview and keep their address', async ({ page }) => {
  await portalApi(page)
  for (const path of ['/parent', '/parent/', '/parent/nope']) {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('A little progress, daily.')
    await expect(current(page)).toHaveText('Overview')
    expect(new URL(page.url()).pathname).toBe(path)
  }
})

test('tabs change the address without a page load, and Back and Forward move between them', async ({
  page,
}) => {
  await portalApi(page)
  let loads = 0
  page.on('load', () => loads++)
  await page.goto('/parent')
  const path = () => new URL(page.url()).pathname

  await nav(page).getByRole('link', { name: 'Streak' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Make every day count.')
  expect(path()).toBe('/parent/streak')
  await nav(page).getByRole('link', { name: 'Devices' }).click()
  expect(path()).toBe('/parent/devices')

  // The tab that is already open adds no history entry.
  const length = await page.evaluate(() => history.length)
  await nav(page).getByRole('link', { name: 'Devices' }).click()
  expect(await page.evaluate(() => history.length)).toBe(length)

  await page.goBack()
  await expect(current(page)).toHaveText('Streak')
  expect(path()).toBe('/parent/streak')
  await page.goBack()
  await expect(current(page)).toHaveText('Overview')
  expect(path()).toBe('/parent')
  await page.goForward()
  await expect(current(page)).toHaveText('Streak')
  expect(loads).toBe(1)

  await page.reload()
  await expect(current(page)).toHaveText('Streak')
  expect(path()).toBe('/parent/streak')
})

test('on a phone the tabs are a bar at the bottom and the header shows', async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 })
  await portalApi(page)
  await page.goto('/parent/overview')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  const bar = await nav(page).boundingBox()
  expect(bar).not.toBeNull()
  expect(Math.round(bar!.y + bar!.height)).toBe(874)
  await expect(page.locator('.portal-header')).toBeVisible()
  await expect(page.locator('.portal-header')).toContainText('macworx')
  await expect(page.locator('.portal-header')).toContainText('Parent space')
  await expect(page.locator('.portal-assurance')).toBeHidden()
  await expect(page.locator('.portal-eyebrow')).toBeHidden()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)

  // The footer note ends Overview and is clear of the bar.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  const note = await page.locator('.portal-note').boundingBox()
  const barNow = await nav(page).boundingBox()
  expect(note!.y + note!.height).toBeLessThanOrEqual(barNow!.y)
})

test('the wide layout starts at 768px wide', async ({ page }) => {
  await portalApi(page)
  await page.setViewportSize({ width: 767, height: 900 })
  await page.goto('/parent/overview')
  await expect(page.locator('.portal-header')).toBeVisible()
  await expect(page.locator('.portal-side')).not.toHaveCSS('position', 'sticky')
  await page.setViewportSize({ width: 768, height: 900 })
  await expect(page.locator('.portal-header')).toBeHidden()
  await expect(page.locator('.portal-side')).toHaveCSS('position', 'sticky')
})

test('at tablet widths a side bar replaces the header and the bar', async ({ page }) => {
  await portalApi(page)
  await page.goto('/parent/overview')
  const viewport = page.viewportSize()!
  const side = await page.locator('.portal-side').boundingBox()
  expect(side!.x).toBe(0)
  expect(side!.width).toBe(216)
  const bar = await nav(page).boundingBox()
  expect(bar!.y + bar!.height).toBeLessThan(viewport.height)
  await expect(page.locator('.portal-header')).toBeHidden()
  await expect(page.locator('.portal-note')).toBeHidden()
  await expect(page.locator('.portal-assurance')).toBeVisible()
  await expect(page.locator('.portal-assurance')).toContainText(
    'Parent-only controls. Their progress stays theirs.',
  )
  await expect(page.locator('.portal-eyebrow')).toBeVisible()
  await expect(page.locator('.portal-eyebrow')).toHaveText('Overview')
})

test('the child switcher picks the first child, switches every read, and is remembered', async ({ page }) => {
  const calls = await portalApi(page)
  await page.goto('/parent/overview')
  await expect(page.getByText("Ada's overview")).toBeVisible()
  await expect.poll(() => reads(calls, 'log').length).toBe(1)
  for (const name of READS) expect(reads(calls, name)).toEqual([`/api/parent/${name}?child=1`])

  const switcher = page.locator('.portal-switcher > button')
  await expect(switcher).toContainText('4th grade · Child profile')
  await switcher.click()
  const list = page.getByRole('list', { name: 'Choose a child' })
  await expect(list.getByRole('button')).toHaveCount(2)
  calls.length = 0
  await list.getByRole('button', { name: /Bo/ }).click()
  await expect(page.getByText("Bo's overview")).toBeVisible()
  await expect(list).toHaveCount(0)
  await expect.poll(() => reads(calls, 'log').length).toBe(1)
  await page.waitForTimeout(300)
  for (const name of READS) expect(reads(calls, name)).toEqual([`/api/parent/${name}?child=2`])
  await expect(page.locator('.portal-switcher > button')).toContainText('Bo')

  // Tabs keep the child.
  await nav(page).getByRole('link', { name: 'Devices' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("Bo's devices, connected.")

  calls.length = 0
  await page.reload()
  await expect.poll(() => reads(calls, 'summary').length).toBe(1)
  expect(reads(calls, 'summary')).toEqual(['/api/parent/summary?child=2'])
})

test('a remembered child who is gone falls back to the first', async ({ page }) => {
  const calls = await portalApi(page)
  await page.addInitScript(() => localStorage.setItem('macworx.parentChild', '99'))
  await page.goto('/parent/overview')
  await expect(page.getByText("Ada's overview")).toBeVisible()
  expect(reads(calls, 'summary')).toEqual(['/api/parent/summary?child=1'])
})

test('with storage blocked, the portal still works', async ({ page }) => {
  await portalApi(page)
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('blocked')
      },
    })
  })
  await page.goto('/parent/overview')
  await expect(page.getByText("Ada's overview")).toBeVisible()
  await page.locator('.portal-switcher > button').click()
  await page.getByRole('list', { name: 'Choose a child' }).getByRole('button', { name: /Bo/ }).click()
  await expect(page.getByText("Bo's overview")).toBeVisible()
})

test('Escape closes the child list', async ({ page }) => {
  await portalApi(page)
  await page.goto('/parent/overview')
  const switcher = page.locator('.portal-switcher > button')
  await switcher.click()
  await expect(switcher).toHaveAttribute('aria-expanded', 'true')
  await page.keyboard.press('Escape')
  await expect(switcher).toHaveAttribute('aria-expanded', 'false')
})

test('an Access reload on the first children call never flashes the sign-in alert', async ({ page }) => {
  // Records whether an alert ever shows, on any load of the page.
  await page.addInitScript(() => {
    new MutationObserver(() => {
      if (document.querySelector('[role="alert"]')) sessionStorage.setItem('test.alertSeen', '1')
    }).observe(document, { childList: true, subtree: true })
  })
  const calls = await portalApi(page)
  let first = true
  await page.route('/api/parent/children', (route) => {
    if (!first) return route.fallback()
    first = false
    // Like an Access sign-in page: not JSON.
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<html>Sign in</html>' })
  })
  let loads = 0
  page.on('load', () => loads++)
  await page.goto('/parent/overview')
  await expect.poll(() => loads).toBe(2)
  await expect(page.getByText("Ada's overview")).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('test.alertSeen'))).toBeNull()
  expect(reads(calls, 'children')).toHaveLength(1)
})

test('a refused Worker shows the message on every tab, never a blank page or Loading', async ({ page }) => {
  await page.route('/api/parent/**', (route) =>
    route.fulfill({ status: 401, json: { error: 'unauthorized' } }),
  )
  // How many lists say "Not available right now." on each tab.
  const lists: Record<string, number> = { overview: 1, points: 1, streak: 0, devices: 1, shop: 0 }
  for (const tab of TABS) {
    await page.goto(`/parent/${tab.path}`)
    await expect(page.getByRole('alert')).toHaveText(
      'Something went wrong on our side. Try again in a minute.',
    )
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(tab.label)
    await expect(page.getByText('Loading…')).toHaveCount(0)
    await expect(page.getByText('Not available right now.')).toHaveCount(lists[tab.path])
  }
})
