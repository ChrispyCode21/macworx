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
  const list = children.map((c) => ({ ...c }))
  const filled = (name: string) =>
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('')
  await page.route('/api/parent/**', (route) => {
    const url = new URL(route.request().url())
    calls.push(`${route.request().method()} ${url.pathname}${url.search}`.replace(/^GET /, ''))
    const body = route.request().postDataJSON() as { name: string; grade?: string; initials?: string }
    if (route.request().method() === 'POST' && url.pathname === '/api/parent/children') {
      const child = {
        id: list.length + 1,
        name: body.name,
        grade: body.grade ?? '',
        initials: body.initials || filled(body.name),
      }
      list.push(child)
      return route.fulfill({ status: 201, json: child })
    }
    if (route.request().method() === 'PATCH') {
      const child = list.find((c) => `/api/parent/children/${c.id}` === url.pathname)!
      Object.assign(child, { ...body, initials: body.initials || filled(body.name) })
      return route.fulfill({ json: child })
    }
    const answers: Record<string, unknown> = {
      '/api/parent/children': { children: list },
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
  // The last tab, Shop, has its screen.
  await expect(page.locator('.shop')).toBeVisible()
})

test('the Shop screen is read-only: rewards, a disabled editor and an empty Last redeemed', async ({
  page,
}) => {
  await portalApi(page)
  await page.goto('/parent/shop')
  const shop = page.locator('.shop')
  await expect(shop.getByText('Ada has 41 Macaronis')).toBeVisible()
  await expect(shop.getByText('1 reward within reach.')).toBeVisible()
  await expect(shop.getByText('4 active')).toBeVisible()
  await expect(shop.getByText('30 Macaronis · Within reach')).toBeVisible()
  await expect(shop.getByText('75 Macaronis · 34 more to go')).toBeVisible()
  await expect(shop.getByText('300 Macaronis · 259 more to go')).toBeVisible()
  await expect(shop.getByText('10,000 Macaronis · 9,959 more to go')).toBeVisible()
  for (const name of ['Ice Cream', 'Pet Store', 'Camping', 'Puppy'])
    await expect(shop.locator('.shop-name', { hasText: name })).toBeVisible()

  await expect(shop.getByText('Editing rewards is coming soon.')).toBeVisible()
  await expect(shop.getByText('Read-only')).toBeVisible()
  await expect(shop.getByText('No rewards redeemed yet.')).toBeVisible()

  const controls = shop.locator('button, input')
  expect(await controls.count()).toBeGreaterThanOrEqual(10)
  for (const control of await controls.all()) await expect(control).toBeDisabled()

  // At 1024px and wider the editor sits to the right of the rewards list; below, under it.
  const list = await shop.locator('.shop-rewards').boundingBox()
  const editor = await shop.locator('.shop-editor').boundingBox()
  if (page.viewportSize()!.width >= 1024) expect(editor!.x).toBeGreaterThan(list!.x + list!.width - 1)
  else expect(editor!.y).toBeGreaterThan(list!.y + list!.height - 1)
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
  // Each child has a choose button and a Rename button, and the list ends with "Add a child".
  await expect(list.getByRole('button')).toHaveCount(5)
  calls.length = 0
  await list.getByRole('button', { name: /^Bo/ }).click()
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

test('when the first children call fails, the screens still use the remembered child', async ({ page }) => {
  const calls = await portalApi(page)
  await page.addInitScript(() => localStorage.setItem('macworx.parentChild', '2'))
  let first = true
  await page.route('/api/parent/children', (route) => {
    if (!first) return route.fallback()
    first = false
    return route.fulfill({ status: 503, json: { error: 'server' } })
  })
  await page.goto('/parent/overview')
  await expect.poll(() => reads(calls, 'summary').length).toBe(1)
  expect(reads(calls, 'summary')).toEqual(['/api/parent/summary?child=2'])
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
  await page.getByRole('list', { name: 'Choose a child' }).getByRole('button', { name: /^Bo/ }).click()
  await expect(page.getByText("Bo's overview")).toBeVisible()
})

test('a save that finishes after a child switch sends no more reads', async ({ page }) => {
  const calls = await portalApi(page)
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => (release = resolve))
  await page.route('/api/parent/adjust*', async (route) => {
    await held
    return route.fulfill({ json: { balance: 42 } })
  })
  await page.goto('/parent/points')
  await expect(page.getByLabel('How many Macaronis')).toBeVisible()
  await page.getByLabel('How many Macaronis').fill('1')
  await page.getByLabel('Note').fill('A note')
  await page.getByRole('button', { name: 'Save Macaronis' }).click()

  await page.locator('.portal-switcher > button').click()
  await page.getByRole('list', { name: 'Choose a child' }).getByRole('button', { name: /^Bo/ }).click()
  await expect.poll(() => reads(calls, 'log').length).toBe(2)
  await page.waitForTimeout(200)
  calls.length = 0
  release()
  await page.waitForTimeout(300)
  expect(calls.filter((c) => !c.startsWith('/api/parent/adjust'))).toEqual([])
})

test('Escape closes the child list', async ({ page }) => {
  await portalApi(page)
  await page.goto('/parent/overview')
  const switcher = page.locator('.portal-switcher > button')
  await switcher.click()
  await expect(switcher).toHaveAttribute('aria-expanded', 'true')
  await expect(switcher).toHaveAttribute('aria-controls', 'portal-children')
  await page.getByRole('list', { name: 'Choose a child' }).getByRole('button').first().focus()
  await page.keyboard.press('Escape')
  await expect(switcher).toHaveAttribute('aria-expanded', 'false')
  await expect(switcher).not.toHaveAttribute('aria-controls')
  await expect(switcher).toBeFocused()
})

test('choosing a child returns focus to the switcher, and a tab change closes the list', async ({ page }) => {
  await portalApi(page)
  await page.goto('/parent/overview')
  const switcher = page.locator('.portal-switcher > button')
  await switcher.click()
  await page.getByRole('list', { name: 'Choose a child' }).getByRole('button', { name: /^Bo/ }).click()
  await expect(switcher).toBeFocused()
  await switcher.click()
  await expect(switcher).toHaveAttribute('aria-expanded', 'true')
  await nav(page).getByRole('link', { name: 'Streak' }).click()
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

const panel = (page: Page) => page.getByRole('region', { name: 'Children' })
const switcherList = (page: Page) => page.getByRole('list', { name: 'Choose a child' })

test('the child list has a Rename button per child and an "Add a child" row', async ({ page }) => {
  await portalApi(page)
  await page.goto('/parent/overview')
  await page.locator('.portal-switcher > button').click()
  await expect(switcherList(page).getByRole('button', { name: 'Rename Ada' })).toBeVisible()
  await expect(switcherList(page).getByRole('button', { name: 'Rename Bo' })).toBeVisible()
  await expect(switcherList(page).getByRole('button', { name: 'Add a child' })).toBeVisible()
})

test('"Add a child" opens Overview in Add mode with Name focused, and adding selects the new child', async ({
  page,
}) => {
  const calls = await portalApi(page)
  await page.goto('/parent/streak')
  await page.locator('.portal-switcher > button').click()
  await switcherList(page).getByRole('button', { name: 'Add a child' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('A little progress, daily.')
  expect(new URL(page.url()).pathname).toBe('/parent/overview')
  await expect(page.locator('.portal-switcher > button')).toHaveAttribute('aria-expanded', 'false')
  await expect(panel(page).getByRole('radio', { name: 'Add a child' })).toBeChecked()
  await expect(panel(page).getByLabel('Name', { exact: true })).toBeFocused()

  const save = panel(page).getByRole('button', { name: 'Save' })
  await expect(save).toBeDisabled()
  await panel(page).getByLabel('Name', { exact: true }).fill('Mary Jane')
  await expect(panel(page).getByLabel('Initials')).toHaveAttribute('placeholder', 'MJ')
  await expect(save).toBeEnabled()
  calls.length = 0
  await save.click()

  await expect(page.getByText("Mary Jane's overview")).toBeVisible()
  await expect(page.locator('.portal-switcher > button')).toContainText('Mary Jane')
  await expect(panel(page).getByRole('status')).toHaveText('Added Mary Jane.')
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused()
  await expect.poll(() => reads(calls, 'log').length).toBe(1)
  expect(reads(calls, 'summary')).toEqual(['/api/parent/summary?child=3'])
  expect(calls).toContain('POST /api/parent/children')

  // The choice is remembered.
  calls.length = 0
  await page.reload()
  await expect.poll(() => reads(calls, 'summary').length).toBe(1)
  expect(reads(calls, 'summary')).toEqual(['/api/parent/summary?child=3'])
})

test('Rename on a row opens Overview in Rename mode for that child; the initials follow the new name', async ({
  page,
}) => {
  const calls = await portalApi(page)
  await page.goto('/parent/overview')
  await page.locator('.portal-switcher > button').click()
  await switcherList(page).getByRole('button', { name: 'Rename Bo' }).click()
  await expect(page.getByText("Bo's overview")).toBeVisible()
  await expect(panel(page).getByRole('radio', { name: 'Rename' })).toBeChecked()
  await expect(panel(page).getByLabel('Name', { exact: true })).toHaveValue('Bo')
  await expect(panel(page).getByLabel('Name', { exact: true })).toBeFocused()
  // Her initials are the ones filled from her name, so the box starts empty and follows the name.
  await expect(panel(page).getByLabel('Initials')).toHaveValue('')

  await panel(page).getByLabel('Name', { exact: true }).fill('Zed Yu')
  calls.length = 0
  await panel(page).getByRole('button', { name: 'Save' }).click()
  await expect(panel(page).getByRole('status')).toHaveText('Saved. Zed Yu is up to date.')
  await expect(page.locator('.portal-switcher > button')).toContainText('Zed Yu')
  await expect(page.locator('.portal-switcher > button')).toBeFocused()
  expect(calls).toContain('PATCH /api/parent/children/2')
  await page.locator('.portal-switcher > button').click()
  await expect(switcherList(page).getByRole('button', { name: 'Rename Zed Yu' })).toBeVisible()
  await expect(switcherList(page).locator('.portal-avatar').nth(1)).toHaveText('ZY')
})

test('typed initials stay, and Rename can be chosen from the panel', async ({ page }) => {
  await portalApi(page)
  await page.goto('/parent/overview')
  await panel(page).getByRole('radio', { name: 'Rename' }).click()
  await expect(panel(page).getByLabel('Name', { exact: true })).toHaveValue('Ada')
  await expect(panel(page).getByLabel('Grade (optional)')).toHaveValue('4th grade')
  await panel(page).getByLabel('Initials').fill('ax')
  await panel(page).getByRole('button', { name: 'Save' }).click()
  await expect(page.locator('.portal-switcher .portal-avatar').first()).toHaveText('AX')
})

test('a rename that finishes after a child switch leaves the switched-to child selected', async ({ page }) => {
  const calls = await portalApi(page)
  let release: () => void = () => {}
  const held = new Promise<void>((resolve) => (release = resolve))
  await page.route('/api/parent/children/1', async (route) => {
    await held
    return route.fallback()
  })
  await page.goto('/parent/overview')
  await panel(page).getByRole('radio', { name: 'Rename' }).click()
  await panel(page).getByLabel('Name', { exact: true }).fill('Ada Q')
  await panel(page).getByRole('button', { name: 'Save' }).click()

  await page.locator('.portal-switcher > button').click()
  await switcherList(page).getByRole('button', { name: /^Bo/ }).first().click()
  await expect(page.getByText("Bo's overview")).toBeVisible()
  await expect.poll(() => reads(calls, 'summary').length).toBe(2)
  calls.length = 0
  release()

  await expect(panel(page).getByRole('status')).toHaveText('Saved. Ada Q is up to date.')
  await expect(page.locator('.portal-switcher > button')).toContainText('Bo')
  await expect(page.getByText("Bo's overview")).toBeVisible()
  await expect.poll(() => reads(calls, 'summary').length).toBe(1)
  expect(reads(calls, 'summary')).toEqual(['/api/parent/summary?child=2'])
})

test('Escape closes the list and returns focus to the switcher after the Rename button', async ({ page }) => {
  await portalApi(page)
  await page.goto('/parent/overview')
  const switcher = page.locator('.portal-switcher > button')
  await switcher.click()
  await switcherList(page).getByRole('button', { name: 'Rename Ada' }).focus()
  await page.keyboard.press('Escape')
  await expect(switcher).toHaveAttribute('aria-expanded', 'false')
  await expect(switcher).toBeFocused()
})
