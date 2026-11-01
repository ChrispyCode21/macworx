import { expect, test, type Page, type Route } from '@playwright/test'

// The parent page at /parent (SPEC §5.3), with /api/parent answered by the test. Access itself isn't here:
// these check what the page does with the Worker's answers, and with Access's sign-in redirect.

interface Device {
  id: number
  label: string
  createdAt: string
  revokedAt: string | null
  lastResultAt: string | null
}

const summary = {
  balance: 41,
  streak: 3,
  lastDay: '2026-10-16',
  completed: 5,
  earnedToday: 0,
  completedToday: 0,
}

/** The Worker's answer to each read view (SPEC §8); `views` replaces any of them. */
function readViews(path: string, devices: Device[], views: Record<string, unknown> = {}) {
  const answers: Record<string, unknown> = {
    '/api/parent/children': { children: [{ id: 1, name: 'Child', grade: '', initials: 'C' }] },
    '/api/parent/summary': summary,
    '/api/parent/days': { days: ['2026-10-15', '2026-10-16'] },
    '/api/parent/results': { results: [] },
    '/api/parent/log': { entries: [] },
    '/api/parent/devices': { devices },
    ...views,
  }
  return answers[path]
}

async function parentApi(
  page: Page,
  devices: Device[],
  code = '012345',
  views: Record<string, unknown> = {},
) {
  const calls: string[] = []
  let balance = summary.balance
  // Newest first, like the Worker's log.
  const entries: unknown[] = []
  await page.route('/api/parent/**', async (route: Route) => {
    const req = route.request()
    calls.push(`${req.method()} ${new URL(req.url()).pathname}`)
    if (req.method() === 'GET')
      return route.fulfill({
        json: readViews(new URL(req.url()).pathname, devices, {
          '/api/parent/summary': { ...summary, balance },
          '/api/parent/log': { entries },
          ...views,
        }),
      })
    if (req.method() === 'DELETE') {
      const id = Number(new URL(req.url()).pathname.split('/').pop())
      devices = devices.map((d) => (d.id === id ? { ...d, revokedAt: '2026-10-20T12:00:00Z' } : d))
      return route.fulfill({ json: { ok: true } })
    }
    if (new URL(req.url()).pathname === '/api/parent/balance') {
      const { amount, note } = req.postDataJSON()
      if (balance + amount < 0) return route.fulfill({ status: 409, json: { error: 'overdraw', balance } })
      entries.unshift({
        id: entries.length + 1,
        at: '2026-10-20T15:05:00',
        email: 'mum@example.com',
        action: 'balance',
        detail: { amount, before: balance, after: balance + amount, note },
      })
      balance += amount
      return route.fulfill({ json: { balance } })
    }
    const { name } = req.postDataJSON()
    if (!name || name.length > 40) return route.fulfill({ status: 400, json: { error: 'bad_name' } })
    return route.fulfill({
      status: 201,
      json: { code, expiresAt: new Date(Date.now() + 10 * 60_000).toISOString() },
    })
  })
  return calls
}

const herIpad: Device = {
  id: 1,
  label: 'Her iPad',
  createdAt: '2026-10-19T12:00:00Z',
  revokedAt: null,
  lastResultAt: null,
}

test('makes a code for a named device and counts it down', async ({ page }) => {
  await page.clock.install()
  await parentApi(page, [])
  await page.goto('/parent/devices')
  await expect(page.getByRole('heading', { name: "Child's devices, connected." })).toBeVisible()
  await expect(page.getByText('No devices paired yet.')).toBeVisible()
  await expect(page.getByText('Connect another device')).toBeVisible()
  await expect(
    page.getByText("Open macworx on Child's device, then enter the one-time pairing code."),
  ).toBeVisible()
  await expect(page.getByText('Codes expire after 10 minutes. Keep yours private.')).toBeVisible()
  await page.getByLabel('Device name').fill('Kitchen tablet')
  await page.getByRole('button', { name: 'Generate pairing code' }).click()
  await expect(page.getByText('012 345')).toBeVisible()
  await expect(page.getByText('Expires in 10 minutes.')).toBeVisible()
  await page.clock.fastForward('09:30')
  await expect(page.getByText('Expires in 1 minute.')).toBeVisible()
  await page.clock.fastForward('01:00')
  await expect(page.getByText('This code has run out. Make a new one.')).toBeVisible()
})

test('asks for a name before making a code', async ({ page }) => {
  const calls = await parentApi(page, [])
  await page.goto('/parent/devices')
  // Let the page finish loading: a load that ends later clears any message.
  await expect(page.getByText('No devices paired yet.')).toBeVisible()
  const message = page.getByText('Give the device a name of up to 40 characters.')
  const make = page.getByRole('button', { name: 'Generate pairing code' })
  await make.click()
  await expect(message).toBeVisible()
  // A name of only spaces is as good as none.
  await page.getByLabel('Device name').fill('    ')
  await make.click()
  await expect(message).toBeVisible()
  // The box takes no more than 40 characters.
  await page.getByLabel('Device name').fill('x'.repeat(41))
  await expect(page.getByLabel('Device name')).toHaveValue('x'.repeat(40))
  expect(calls.filter((c) => c.startsWith('POST'))).toEqual([])
  // The page asks for the children first, then reads the first child's numbers.
  expect(calls.slice(0, 2)).toEqual(['GET /api/parent/children', 'GET /api/parent/summary'])
})

test('makes the code for the chosen child', async ({ page }) => {
  const posts: { url: string; body: unknown }[] = []
  page.on('request', (req) => {
    if (req.method() === 'POST') posts.push({ url: req.url(), body: req.postDataJSON() })
  })
  await parentApi(page, [], '246810', {
    '/api/parent/children': {
      children: [
        { id: 1, name: 'Ada', grade: '', initials: 'A' },
        { id: 2, name: 'Bo', grade: '', initials: 'B' },
      ],
    },
  })
  await page.goto('/parent/devices')
  await page.locator('.portal-switcher > button').click()
  await page.getByRole('list', { name: 'Choose a child' }).getByRole('button', { name: /^Bo/ }).click()
  await expect(
    page.getByText("Open macworx on Bo's device, then enter the one-time pairing code."),
  ).toBeVisible()
  await page.getByLabel('Device name').fill('Den tablet')
  await page.getByRole('button', { name: 'Generate pairing code' }).click()
  await expect(page.getByText('246 810')).toBeVisible()
  expect(posts).toHaveLength(1)
  expect(new URL(posts[0].url).searchParams.get('child')).toBe('2')
  expect(posts[0].body).toEqual({ name: 'Den tablet' })
})

test('says what disconnecting does, with her name, balance and streak', async ({ page }) => {
  await parentApi(page, [])
  await page.goto('/parent/devices')
  await expect(page.getByText('Before you disconnect')).toBeVisible()
  await expect(
    page.getByText(
      "Removing a device stops it from saving progress for Child. Child's synced homework, 41 Macaronis and 3-day streak stay safe.",
    ),
  ).toBeVisible()
  await expect(
    page.getByText(
      "You'll review the device name, then confirm. Anything not yet synced from that device stays on it.",
    ),
  ).toBeVisible()
  await expect(page.getByText('Child access only')).toBeVisible()
  await expect(page.getByText("Paired devices can't open parent controls.")).toBeVisible()
})

test('the pair panel sits beside the device cards when wide, and below them on a tablet', async ({
  page,
}) => {
  await parentApi(page, [herIpad])
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/parent/devices')
  const card = page.locator('.device-card')
  const panel = page.locator('.pair-panel')
  await expect(card).toBeVisible()
  const wideCard = (await card.boundingBox())!
  const widePanel = (await panel.boundingBox())!
  expect(widePanel.x).toBeGreaterThan(wideCard.x + wideCard.width)

  await page.setViewportSize({ width: 820, height: 1000 })
  const narrowCard = (await card.boundingBox())!
  const narrowPanel = (await panel.boundingBox())!
  expect(narrowPanel.y).toBeGreaterThan(narrowCard.y + narrowCard.height)
})

test('unpairs a device after the warning, and keeps it when asked', async ({ page }) => {
  const calls = await parentApi(page, [herIpad])
  await page.goto('/parent/devices')
  await expect(page.getByText('Added Oct 19')).toBeVisible()
  await expect(page.getByText('1 connected')).toBeVisible()

  await page.getByRole('button', { name: 'Unpair Her iPad' }).click()
  const warning = "Unpair Her iPad? Results this device hasn't sent yet won't be saved."
  await expect(page.getByRole('alertdialog').getByText(warning)).toBeVisible()
  await page.getByRole('button', { name: 'Keep it paired' }).click()
  expect(calls).not.toContain('DELETE /api/parent/devices/1')
  await expect(page.getByText('Added Oct 19')).toBeVisible()

  await page.getByRole('button', { name: 'Unpair Her iPad' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Unpair', exact: true }).click()
  // An unpaired device drops off the list.
  await expect(page.getByText('0 connected')).toBeVisible()
  await expect(page.getByText('Added Oct 19')).toHaveCount(0)
  expect(calls).toContain('DELETE /api/parent/devices/1')
  await expect(page.getByRole('button', { name: /^Unpair/ })).toHaveCount(0)
})

test('a device card shows when it last synced, and labels the sample items', async ({ page }) => {
  // Pin the page's clock to a fixed local noon so "today" cannot drift with the wall clock.
  await page.clock.setFixedTime(new Date(2026, 9, 17, 12, 0))
  const sync = new Date(2020, 5, 3, 16, 5).toISOString()
  const today = new Date(2026, 9, 17, 9, 7)
  await parentApi(page, [
    herIpad,
    { ...herIpad, id: 2, label: 'Kitchen tablet', lastResultAt: sync },
    { ...herIpad, id: 3, label: 'Den tablet', lastResultAt: today.toISOString() },
  ])
  await page.goto('/parent/devices')
  await expect(page.getByText('3 connected')).toBeVisible()
  await expect(page.getByText('No results yet')).toHaveCount(1)
  await expect(page.getByText('Synced Jun 3')).toBeVisible()
  await expect(page.getByText('Synced today, 9:07 am')).toBeVisible()
  // The status and the browser line are sample data, labelled on each card.
  await expect(page.getByText('Sample', { exact: true })).toHaveCount(6)
  await expect(page.getByRole('button', { name: 'View details' }).first()).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Rename Her iPad' })).toBeDisabled()
})

test('the Worker refusing (as on a preview) shows a message and never reloads', async ({ page }) => {
  await page.route('/api/parent/**', (route) =>
    route.fulfill({ status: 401, json: { error: 'unauthorized' } }),
  )
  let loads = 0
  page.on('load', () => loads++)
  await page.goto('/parent')
  await expect(page.getByRole('alert')).toHaveText('Something went wrong on our side. Try again in a minute.')
  // The hero, the two tiles, the assignments list and the devices row each show a dash.
  await expect(page.locator('.overview').getByText('—')).toHaveCount(5)
  await expect(page.getByText('Loading…')).toHaveCount(0)
  // Overview holds one list, Results.
  await expect(page.getByText('Not available right now.')).toHaveCount(1)
  await page.waitForTimeout(500)
  expect(loads).toBe(1)
})

test('a run-out Access sign-in reloads the page once, not forever', async ({ page }) => {
  // With redirect: 'manual' a real Access redirect arrives as an opaque response; the page treats it like this
  // non-JSON sign-in page (Playwright can't fake a redirect status).
  await page.route('/api/parent/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<html>Sign in</html>' }),
  )
  let loads = 0
  page.on('load', () => loads++)
  await page.goto('/parent')
  await expect.poll(() => loads).toBe(2)
  await page.waitForTimeout(500)
  expect(loads).toBe(2)
})

test('shows her numbers, results and the activity log in plain words', async ({ page }) => {
  await page.route('/api/parent/**', (route) =>
    route.fulfill({
      json: readViews(new URL(route.request().url()).pathname, [herIpad], {
        '/api/parent/results': {
          results: [
            { id: 2, day: '2026-10-16', answered: 8, correct: 7, finished: false, grade: null, total: 7 },
            {
              id: 1,
              day: '2026-10-15',
              answered: 20,
              correct: 18,
              finished: true,
              grade: 'Great',
              total: 22,
            },
          ],
        },
        '/api/parent/log': {
          entries: [
            {
              id: 2,
              at: '2026-10-20T15:05:00',
              email: 'mum@example.com',
              action: 'unpair',
              detail: { deviceId: 1 },
            },
            {
              id: 1,
              at: '2026-10-19T09:00:00',
              email: 'dad@example.com',
              action: 'pairing_code',
              detail: { name: 'Her iPad' },
            },
          ],
        },
      }),
    }),
  )
  await page.goto('/parent/overview')
  const tiles = page.locator('.overview-stats')
  await expect(tiles.getByText('41')).toBeVisible()
  await expect(tiles.getByText('3 days')).toBeVisible()
  await expect(page.getByText('5 assignments done in all · Last counted day Oct 16')).toBeVisible()

  const results = page.getByRole('table')
  await expect(results.getByRole('row')).toHaveCount(3)
  await expect(results.getByRole('row').nth(1)).toHaveText(/Oct 167 of 8Left early7/)
  await expect(results.getByRole('row').nth(2)).toHaveText(/Oct 1518 of 20Great22/)
  await expect(page.getByRole('button', { name: /Review the result/ })).toHaveCount(0)

  await page.getByRole('link', { name: 'Macaronis', exact: true }).click()
  const log = page.locator('.activity-list')
  await expect(log.getByText('Unpaired Her iPad')).toBeVisible()
  await expect(log.getByText('Made a pairing code for Her iPad')).toBeVisible()
  await expect(log.getByText('mum@example.com')).toBeVisible()
})

test('says so when there are no results or log entries yet', async ({ page }) => {
  await parentApi(page, [])
  await page.goto('/parent/overview')
  await expect(page.getByText('No results yet.')).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
  await page.getByRole('link', { name: 'Macaronis', exact: true }).click()
  await expect(page.getByText('Nothing here yet.')).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
})

test('a new child shows no last counted day', async ({ page }) => {
  await page.route('/api/parent/**', (route) =>
    route.fulfill({
      json: readViews(new URL(route.request().url()).pathname, [], {
        '/api/parent/summary': {
          balance: 0,
          streak: 0,
          lastDay: null,
          completed: 0,
          earnedToday: 0,
          completedToday: 0,
        },
      }),
    }),
  )
  await page.goto('/parent/overview')
  await expect(page.getByText('None yet')).toBeVisible()
})

test('a bad_day on the summary read says something went wrong, not a streak problem', async ({ page }) => {
  await page.route('/api/parent/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/parent/summary') return route.fulfill({ status: 400, json: { error: 'bad_day' } })
    return route.fulfill({ json: readViews(path, []) })
  })
  await page.goto('/parent/overview')
  await expect(page.getByRole('alert')).toHaveText('Something went wrong on our side. Try again in a minute.')
})

test('a bad_day on the re-read after a refused removal says something went wrong, not a streak problem', async ({
  page,
}) => {
  let summaryReads = 0
  await page.route('/api/parent/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (route.request().method() === 'POST')
      return route.fulfill({ status: 409, json: { error: 'overdraw', balance: 41 } })
    if (path === '/api/parent/summary' && ++summaryReads > 1)
      return route.fulfill({ status: 400, json: { error: 'bad_day' } })
    return route.fulfill({ json: readViews(path, []) })
  })
  await page.goto('/parent/points')
  await page.getByRole('radio', { name: 'Remove Macaronis' }).click()
  await page.getByLabel('Macaronis to remove').fill('5')
  await page.getByLabel('Reason · required').fill('Too many')
  await page.getByRole('button', { name: /^Review/ }).click()
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByRole('alert')).toHaveText('Something went wrong on our side. Try again in a minute.')
})

test('her app at / never shows the parent page', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
  await expect(page.getByText('Parent space')).toHaveCount(0)
})

test('after the one reload, a sign-in that still fails says so instead of going quiet', async ({ page }) => {
  await page.route('/api/parent/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<html>Sign in</html>' }),
  )
  await page.goto('/parent')
  await expect(page.getByRole('alert')).toHaveText(
    'Your sign-in has run out. Reload the page to sign in again.',
  )
})

test('a successful call clears the reload flag, so a later run-out can reload again', async ({ page }) => {
  await parentApi(page, [herIpad])
  await page.addInitScript(() => sessionStorage.setItem('macworx.parentReloaded', '1'))
  await page.goto('/parent/devices')
  await expect(page.getByText('Added Oct 19')).toBeVisible()
  expect(await page.evaluate(() => sessionStorage.getItem('macworx.parentReloaded'))).toBeNull()
})

test('a Cloudflare error page says try again, without reloading', async ({ page }) => {
  await page.route('/api/parent/**', (route) =>
    route.fulfill({ status: 502, contentType: 'text/html', body: '<html>Bad gateway</html>' }),
  )
  let loads = 0
  page.on('load', () => loads++)
  await page.goto('/parent')
  await expect(page.getByRole('alert')).toHaveText('Something went wrong on our side. Try again in a minute.')
  expect(loads).toBe(1)
})

test('with no connection, says to check the Wi-Fi', async ({ page }) => {
  await page.route('/api/parent/**', (route) => route.abort('internetdisconnected'))
  await page.goto('/parent')
  await expect(page.getByRole('alert')).toHaveText('No connection. Check the Wi-Fi and try again.')
})

test('a later success clears an earlier message', async ({ page }) => {
  let fail = true
  await page.route('/api/parent/**', (route) => {
    if (route.request().method() === 'GET' && fail)
      return route.fulfill({ status: 500, json: { error: 'server' } })
    if (route.request().method() === 'GET')
      return route.fulfill({ json: readViews(new URL(route.request().url()).pathname, []) })
    return route.fulfill({
      status: 201,
      json: { code: '111222', expiresAt: new Date(Date.now() + 600_000).toISOString() },
    })
  })
  await page.goto('/parent/devices')
  await expect(page.getByRole('alert')).toBeVisible()
  fail = false
  await page.getByLabel('Device name').fill('Kitchen tablet')
  await page.getByRole('button', { name: 'Generate pairing code' }).click()
  await expect(page.getByText('111 222')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('Generate pairing code waits for its answer before taking another click', async ({ page }) => {
  let answer: () => void = () => {}
  const posts: number[] = []
  await page.route('/api/parent/**', (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({ json: readViews(new URL(route.request().url()).pathname, []) })
    posts.push(1)
    answer = () =>
      void route.fulfill({
        status: 201,
        json: { code: '333444', expiresAt: new Date(Date.now() + 600_000).toISOString() },
      })
  })
  await page.goto('/parent/devices')
  await page.getByLabel('Device name').fill('Kitchen tablet')
  await page.getByRole('button', { name: 'Generate pairing code' }).click()
  await expect(page.getByRole('button', { name: 'Generate pairing code' })).toBeDisabled()
  answer()
  await expect(page.getByText('333 444')).toBeVisible()
  expect(posts).toHaveLength(1)
})

// The streak form (SPEC §5.3): POST /api/parent/streak answered by the test.
let current = summary
test.beforeEach(() => {
  current = summary
})

async function streakApi(page: Page, answer: (body: unknown) => { status: number; json: unknown }) {
  const posts: unknown[] = []
  await page.route('/api/parent/**', (route) => {
    const req = route.request()
    if (req.method() === 'GET')
      return route.fulfill({
        json: readViews(new URL(req.url()).pathname, [], { '/api/parent/summary': current }),
      })
    posts.push(req.postDataJSON())
    const reply = answer(req.postDataJSON())
    if (reply.status === 200) current = reply.json as typeof summary
    return route.fulfill(reply)
  })
  return posts
}

const review = (page: Page) => page.getByRole('button', { name: 'Review streak correction' })
const confirm = (page: Page) => page.getByRole('button', { name: 'Confirm', exact: true })

test('the streak screen shows her streak, a strip of the last 7 days and a sample personal best', async ({
  page,
}) => {
  await page.clock.install({ time: new Date(2026, 9, 17, 10, 0) })
  await streakApi(page, () => ({ status: 200, json: summary }))
  await page.goto('/parent/streak')
  await expect(page.getByText('Current streak · Oct 14–16')).toBeVisible()
  await expect(page.getByText('Personal best: 14 days')).toBeVisible()
  await expect(page.getByText('Sample', { exact: true })).toBeVisible()
  const tiles = page.locator('.streak-tile')
  await expect(tiles).toHaveCount(7)
  await expect(tiles.first()).toHaveText('11')
  await expect(page.locator('.streak-tile-counted')).toHaveText(['15', '16'])
  await expect(page.locator('.streak-tile-today')).toHaveText('17')
  await expect(page.getByText('counted', { exact: true })).toHaveCount(2)
  await expect(page.getByText('Today ✓')).toHaveCount(0)
})

test('sets her streak: boxes start with her numbers, Review then Confirm saves once', async ({ page }) => {
  const posts = await streakApi(page, (body) => ({
    status: 200,
    json: { ...summary, ...(body as object) },
  }))
  await page.goto('/parent/streak')
  await expect(page.getByLabel('Corrected streak length')).toHaveValue('3')
  await expect(page.getByLabel('Last counted day')).toHaveValue('2026-10-16')
  await page.getByLabel('Corrected streak length').fill('7')
  await expect(page.getByText('Preview: Oct 10–16 · 3 → 7 days')).toBeVisible()
  await review(page).click()
  await expect(page.getByText('Streak 3 → 7 days')).toBeVisible()
  await expect(page.getByText('Last counted day Oct 16 → Oct 16')).toBeVisible()
  await expect(page.getByLabel('Corrected streak length')).toBeDisabled()
  await expect(page.getByLabel('Last counted day')).toBeDisabled()
  expect(posts).toEqual([])
  await confirm(page).click()
  await expect(page.getByRole('status')).toHaveText('Streak saved.')
  expect(posts).toEqual([{ streak: 7, lastDay: '2026-10-16' }])
  // The tabs share one set of numbers: Overview shows the new streak without another read.
  await page.getByRole('link', { name: 'Overview' }).click()
  await expect(page.locator('.overview-stats').getByText('7 days')).toBeVisible()
})

test('Back returns to the form with the typed values and sends nothing', async ({ page }) => {
  const posts = await streakApi(page, () => ({ status: 200, json: summary }))
  await page.goto('/parent/streak')
  await expect(page.getByLabel('Corrected streak length')).toHaveValue('3')
  await page.getByLabel('Corrected streak length').fill('9')
  await review(page).click()
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(review(page)).toBeVisible()
  await expect(page.getByLabel('Corrected streak length')).toHaveValue('9')
  await expect(page.getByLabel('Corrected streak length')).toBeEnabled()
  expect(posts).toEqual([])
})

test('an empty day with streak 0 is sent as null', async ({ page }) => {
  const posts = await streakApi(page, (body) => ({ status: 200, json: { ...summary, ...(body as object) } }))
  await page.goto('/parent/streak')
  await expect(page.getByLabel('Corrected streak length')).toHaveValue('3')
  await page.getByLabel('Corrected streak length').fill('0')
  await page.getByLabel('Last counted day').fill('')
  await expect(page.getByText('Preview: no counted days · 3 → 0 days')).toBeVisible()
  await review(page).click()
  await confirm(page).click()
  await expect(page.getByRole('status')).toHaveText('Streak saved.')
  expect(posts).toEqual([{ streak: 0, lastDay: null }])
})

test('refuses an obviously bad streak at Review, before sending anything', async ({ page }) => {
  const posts = await streakApi(page, () => ({ status: 200, json: summary }))
  await page.goto('/parent/streak')
  const problem =
    'Type a streak from 0 to 3,650 and a last counted day that is not after tomorrow. The day can be empty only when the streak is 0.'
  await expect(page.getByLabel('Corrected streak length')).toHaveValue('3')
  await page.getByLabel('Corrected streak length').fill('3651')
  await review(page).click()
  await expect(page.getByRole('alert')).toHaveText(problem)
  await page.getByLabel('Corrected streak length').fill('3')
  await page.getByLabel('Last counted day').fill('')
  await review(page).click()
  await expect(page.getByRole('alert')).toHaveText(problem)
  await expect(confirm(page)).toHaveCount(0)
  expect(posts).toEqual([])
})

test('a Worker 400 or 503 shows its plain message', async ({ page }) => {
  let reply = { status: 400, json: { error: 'bad_day' } }
  await streakApi(page, () => reply)
  await page.goto('/parent/streak')
  await review(page).click()
  await confirm(page).click()
  await expect(page.getByRole('alert')).toContainText('Type a streak from 0 to 3,650')
  reply = { status: 503, json: { error: 'busy' } }
  await review(page).click()
  await confirm(page).click()
  await expect(page.getByRole('alert')).toHaveText('Her numbers changed while saving. Try again.')
  await expect(page.getByText('Streak saved.')).toHaveCount(0)
})

test('a failed Confirm returns to the form with the typed values and no saved line', async ({ page }) => {
  await streakApi(page, () => ({ status: 503, json: { error: 'busy' } }))
  await page.goto('/parent/streak')
  await expect(page.getByLabel('Corrected streak length')).toHaveValue('3')
  await page.getByLabel('Corrected streak length').fill('9')
  await review(page).click()
  await confirm(page).click()
  await expect(page.getByRole('alert')).toHaveText('Her numbers changed while saving. Try again.')
  await expect(review(page)).toBeVisible()
  await expect(page.getByLabel('Corrected streak length')).toHaveValue('9')
  await expect(page.getByLabel('Last counted day')).toHaveValue('2026-10-16')
  await expect(page.getByLabel('Corrected streak length')).toBeEnabled()
  await expect(page.getByText('Streak saved.')).toHaveCount(0)
})

test('a failed days read shows unavailable, and the next visit to the Streak tab reads again', async ({
  page,
}) => {
  let daysUp = false
  await page.route('/api/parent/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/parent/days' && !daysUp) return route.fulfill({ status: 503, json: { error: 'busy' } })
    return route.fulfill({ json: readViews(path, []) })
  })
  await page.goto('/parent/streak')
  await expect(page.locator('.streak-days')).toHaveCount(0)
  await expect(page.locator('.streak-week').getByText('Not available right now.')).toBeVisible()
  daysUp = true
  await page.getByRole('link', { name: 'Overview' }).click()
  await page.getByRole('link', { name: 'Streak', exact: true }).click()
  await expect(page.locator('.streak-tile')).toHaveCount(7)
})

test('Confirm waits for its answer before taking another click', async ({ page }) => {
  let answer: () => void = () => {}
  const posts: number[] = []
  await page.route('/api/parent/**', (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({ json: readViews(new URL(route.request().url()).pathname, []) })
    posts.push(1)
    answer = () => void route.fulfill({ json: summary })
  })
  await page.goto('/parent/streak')
  await review(page).click()
  await confirm(page).click()
  await expect(confirm(page)).toBeDisabled()
  await confirm(page).click({ force: true })
  answer()
  await expect(page.getByText('Streak saved.')).toBeVisible()
  expect(posts).toHaveLength(1)
})

test('adds Macaronis through Review then Confirm, then removes some', async ({ page }) => {
  const calls = await parentApi(page, [])
  await page.goto('/parent/points')
  await expect(page.getByLabel('Macaronis to add')).toBeVisible()

  await page.getByLabel('Macaronis to add').fill('20')
  await page.getByLabel('Reason · required').fill('Homework grades')
  await expect(page.getByText('61 Macaronis')).toBeVisible()
  await page.getByRole('button', { name: 'Review +20 Macaronis' }).click()
  // Nothing is saved at Review, and the form is locked.
  expect(calls.filter((c) => c.startsWith('POST'))).toEqual([])
  await expect(page.getByText('Add 20 Macaronis: balance 41 → 61. Reason: Homework grades.')).toBeVisible()
  await expect(page.getByLabel('Macaronis to add')).toBeDisabled()
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByText('Saved. Her balance is now 61.')).toBeVisible()
  await expect(page.getByLabel('Macaronis to add')).toHaveValue('')
  await expect(page.locator('.points-hero-number')).toHaveText('61')
  await expect(page.locator('.activity-row').first().locator('.activity-amount')).toHaveText('+20')
  await expect(page.getByText('Added 20 Macaronis: Homework grades')).toBeVisible()
  // Overview shows the new balance.
  await page.getByRole('link', { name: 'Overview' }).click()
  await expect(page.locator('.overview-stats').getByText('61')).toBeVisible()
  await page.getByRole('link', { name: 'Macaronis', exact: true }).click()

  await page.getByRole('radio', { name: 'Remove Macaronis' }).click()
  await page.getByLabel('Macaronis to remove').fill('1')
  await page.getByLabel('Reason · required').fill('Counted twice')
  await page.getByRole('button', { name: 'Review −1 Macaroni' }).click()
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByText('Saved. Her balance is now 60.')).toBeVisible()
  await expect(page.locator('.activity-row').first().locator('.activity-amount')).toHaveText('−1')
  expect(calls.filter((c) => c.startsWith('POST'))).toEqual([
    'POST /api/parent/balance',
    'POST /api/parent/balance',
  ])
})

test('Back from Review returns to the form with what was typed, and saves nothing', async ({ page }) => {
  const calls = await parentApi(page, [])
  await page.goto('/parent/points')
  await page.getByLabel('Macaronis to add').fill('20')
  await page.getByLabel('Reason · required').fill('Homework grades')
  await page.getByRole('button', { name: 'Review +20 Macaronis' }).click()
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByLabel('Macaronis to add')).toHaveValue('20')
  await expect(page.getByLabel('Reason · required')).toHaveValue('Homework grades')
  await expect(page.getByLabel('Macaronis to add')).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Review +20 Macaronis' })).toBeEnabled()
  expect(calls.filter((c) => c.startsWith('POST'))).toEqual([])
})

test('keeps Review disabled until the amount and reason are valid, and sends nothing', async ({ page }) => {
  const calls = await parentApi(page, [])
  await page.goto('/parent/points')
  const review = page.getByRole('button', { name: /^Review/ })
  await expect(review).toBeDisabled()
  await page.getByLabel('Reason · required').fill('A note')
  await expect(review).toBeDisabled()
  await page.getByLabel('Macaronis to add').fill('2.5')
  await expect(review).toBeDisabled()
  await page.getByLabel('Macaronis to add').fill('100001')
  await expect(review).toBeDisabled()
  await page.getByLabel('Macaronis to add').fill('5')
  await expect(review).toBeEnabled()
  await page.getByLabel('Reason · required').fill('   ')
  await expect(review).toBeDisabled()
  expect(calls.filter((c) => c.startsWith('POST'))).toEqual([])
})

test('refuses taking away more than she has, in friendly words', async ({ page }) => {
  const calls = await parentApi(page, [])
  await page.goto('/parent/points')
  await page.getByRole('radio', { name: 'Remove Macaronis' }).click()
  await page.getByLabel('Macaronis to remove').fill('42')
  await page.getByLabel('Reason · required').fill('Too many')
  await expect(page.getByText("Can't go below zero.", { exact: true })).toBeVisible()
  await expect(
    page.getByText("She has 41 Macaronis, so you can't remove more than that. Her balance can't go below 0."),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /^Review/ })).toBeDisabled()
  expect(calls.filter((c) => c.startsWith('POST'))).toEqual([])
})

test('a refusal at Confirm shows her balance and keeps the numbers', async ({ page }) => {
  await page.route('/api/parent/**', (route) => {
    const path = new URL(route.request().url()).pathname
    if (route.request().method() === 'POST')
      return route.fulfill({ status: 409, json: { error: 'overdraw', balance: 3 } })
    return route.fulfill({ json: readViews(path, []) })
  })
  await page.goto('/parent/points')
  await page.getByRole('radio', { name: 'Remove Macaronis' }).click()
  await page.getByLabel('Macaronis to remove').fill('5')
  await page.getByLabel('Reason · required').fill('Fixing the count')
  await page.getByRole('button', { name: /^Review/ }).click()
  await page.getByRole('button', { name: 'Confirm' }).click()
  // Her balance is read again for the line (the 409 carries none): 41 here.
  await expect(page.getByRole('alert')).toHaveText(
    "She has 41 Macaronis, so you can't remove more than that. Her balance can't go below 0.",
  )
  await expect(page.getByLabel('Macaronis to remove')).toHaveValue('5')
})

test('Confirm waits for its answer, so a double click saves once', async ({ page }) => {
  let answer: () => void = () => {}
  const posts: number[] = []
  await page.route('/api/parent/**', (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({ json: readViews(new URL(route.request().url()).pathname, []) })
    posts.push(1)
    answer = () => void route.fulfill({ json: { balance: 46 } })
  })
  await page.goto('/parent/points')
  await page.getByLabel('Macaronis to add').fill('5')
  await page.getByLabel('Reason · required').fill('Extra reading')
  await page.getByRole('button', { name: /^Review/ }).click()
  await page.getByRole('button', { name: 'Confirm' }).dblclick()
  await expect(page.getByRole('button', { name: 'Confirm' })).toBeDisabled()
  answer()
  await expect(page.getByText('Saved. Her balance is now 46.')).toBeVisible()
  expect(posts).toHaveLength(1)
})

test('a busy answer at Confirm says to try again and keeps the numbers', async ({ page }) => {
  await page.route('/api/parent/**', (route) => {
    if (route.request().method() === 'POST') return route.fulfill({ status: 503, json: { error: 'busy' } })
    return route.fulfill({ json: readViews(new URL(route.request().url()).pathname, []) })
  })
  await page.goto('/parent/points')
  await page.getByLabel('Macaronis to add').fill('5')
  await page.getByLabel('Reason · required').fill('Extra reading')
  await page.getByRole('button', { name: /^Review/ }).click()
  await page.getByRole('button', { name: 'Confirm' }).click()
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByLabel('Macaronis to add')).toHaveValue('5')
  await expect(page.getByLabel('Macaronis to add')).toBeEnabled()
  await expect(page.getByLabel('Reason · required')).toHaveValue('Extra reading')
})

test('shows what she earned today beside her balance, and nothing at 0', async ({ page }) => {
  await page.route('/api/parent/**', (route) =>
    route.fulfill({
      json: readViews(new URL(route.request().url()).pathname, [], {
        '/api/parent/summary': { ...summary, earnedToday: 12 },
      }),
    }),
  )
  await page.goto('/parent/points')
  await expect(page.getByText('+12 earned today')).toBeVisible()
})

test('leaves the earned-today line out at 0', async ({ page }) => {
  await parentApi(page, [])
  await page.goto('/parent/points')
  await expect(page.locator('.points-hero-number')).toHaveText('41')
  await expect(page.getByText('earned today')).toHaveCount(0)
})

test('puts the adjust panel to the right of Recent activity when wide, and in order on a phone', async ({
  page,
}) => {
  await parentApi(page, [])
  await page.setViewportSize({ width: 1100, height: 900 })
  await page.goto('/parent/points')
  const adjust = await page.locator('.points-adjust').boundingBox()
  const activity = await page.locator('.points-activity').boundingBox()
  const hero = await page.locator('.points-hero').boundingBox()
  expect(adjust!.x).toBeGreaterThan(activity!.x + activity!.width - 1)
  expect(adjust!.x).toBeGreaterThan(hero!.x + hero!.width - 1)
  expect(activity!.y).toBeGreaterThan(hero!.y)
  await page.setViewportSize({ width: 390, height: 900 })
  const phone = await Promise.all(
    ['.points-hero', '.points-adjust', '.points-activity'].map(
      async (sel) => (await page.locator(sel).boundingBox())!.y,
    ),
  )
  expect(phone[0]).toBeLessThan(phone[1])
  expect(phone[1]).toBeLessThan(phone[2])
})

test('a streak change reads in plain words in the activity log', async ({ page }) => {
  await page.route('/api/parent/**', (route) =>
    route.fulfill({
      json: readViews(new URL(route.request().url()).pathname, [], {
        '/api/parent/log': {
          entries: [
            {
              id: 2,
              at: '2026-10-20T15:05:00',
              email: 'mum@example.com',
              action: 'streak',
              detail: { before: { streak: 3, lastDay: null }, after: { streak: 7, lastDay: '2026-10-16' } },
            },
            {
              id: 1,
              at: '2026-10-19T15:05:00',
              email: 'dad@example.com',
              action: 'streak',
              detail: { after: { streak: 0, lastDay: null } },
            },
          ],
        },
      }),
    }),
  )
  await page.goto('/parent/points')
  const log = page.locator('.activity-list')
  await expect(log.getByText('Set the streak to 7 days, last counted day Oct 16')).toBeVisible()
  await expect(log.getByText('Set the streak to 0 days, no last counted day')).toBeVisible()
})

test('shows adjustments in the activity log in plain words', async ({ page }) => {
  await page.route('/api/parent/**', (route) =>
    route.fulfill({
      json: readViews(new URL(route.request().url()).pathname, [], {
        '/api/parent/log': {
          entries: [
            {
              id: 2,
              at: '2026-10-20T15:05:00',
              email: 'mum@example.com',
              action: 'balance',
              detail: { amount: -5, before: 46, after: 41, note: 'Counted twice' },
            },
            {
              id: 1,
              at: '2026-10-19T09:00:00',
              email: 'dad@example.com',
              action: 'balance',
              detail: { amount: 20, before: 26, after: 46, note: 'Homework grades' },
            },
          ],
        },
      }),
    }),
  )
  await page.goto('/parent/points')
  await expect(page.getByText('Removed 5 Macaronis: Counted twice')).toBeVisible()
  await expect(page.getByText('Added 20 Macaronis: Homework grades')).toBeVisible()
  const rows = page.locator('.activity-row')
  await expect(rows.nth(0).locator('.activity-amount')).toHaveText('−5')
  await expect(rows.nth(1).locator('.activity-amount')).toHaveText('+20')
  await expect(page.getByText(/Balance \d/)).toHaveCount(0)
  await expect(page.getByText('Full history')).toHaveCount(0)
})

test('old correction entries still read in plain words in the activity log', async ({ page }) => {
  await page.route('/api/parent/**', (route) =>
    route.fulfill({
      json: readViews(new URL(route.request().url()).pathname, [], {
        '/api/parent/log': {
          entries: [
            {
              id: 1,
              at: '2026-10-20T15:05:00',
              email: 'mum@example.com',
              action: 'correction',
              detail: {
                resultId: 7,
                day: '2026-10-16',
                before: { correct: 15, grade: 'Improving', total: 21 },
                after: { correct: 18, grade: 'Great', total: 24 },
                balanceBefore: 100,
                balanceAfter: 103,
                note: 'Marked a right answer wrong',
              },
            },
          ],
        },
      }),
    }),
  )
  await page.goto('/parent/points')
  await expect(
    page.getByText(
      'Corrected the result of Oct 16: 15 to 18 right, +3 Macaronis: Marked a right answer wrong',
    ),
  ).toBeVisible()
})
