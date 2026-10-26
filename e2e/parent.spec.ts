import { expect, test, type Page, type Route } from '@playwright/test'

// The parent page at /parent (SPEC §5.3), with /api/parent answered by the test. Access itself isn't here:
// these check what the page does with the Worker's answers, and with Access's sign-in redirect.

interface Device {
  id: number
  label: string
  createdAt: string
  revokedAt: string | null
}

const summary = { balance: 41, streak: 3, lastDay: '2026-10-16', completed: 5 }

/** The Worker's answer to each read view (SPEC §8); `views` replaces any of them. */
function readViews(path: string, devices: Device[], views: Record<string, unknown> = {}) {
  const answers: Record<string, unknown> = {
    '/api/parent/summary': summary,
    '/api/parent/results': { results: [] },
    '/api/parent/log': { entries: [] },
    '/api/parent/devices': { devices },
    ...views,
  }
  return answers[path]
}

async function parentApi(page: Page, devices: Device[], code = '012345') {
  const calls: string[] = []
  let balance = summary.balance
  await page.route('/api/parent/**', async (route: Route) => {
    const req = route.request()
    calls.push(`${req.method()} ${new URL(req.url()).pathname}`)
    if (req.method() === 'GET')
      return route.fulfill({
        json: readViews(new URL(req.url()).pathname, devices, {
          '/api/parent/summary': { ...summary, balance },
        }),
      })
    if (req.method() === 'DELETE') {
      const id = Number(new URL(req.url()).pathname.split('/').pop())
      devices = devices.map((d) => (d.id === id ? { ...d, revokedAt: '2026-10-20T12:00:00Z' } : d))
      return route.fulfill({ json: { ok: true } })
    }
    if (new URL(req.url()).pathname === '/api/parent/balance') {
      const { amount } = req.postDataJSON()
      if (balance + amount < 0) return route.fulfill({ status: 409, json: { error: 'overdraw', balance } })
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

const herIpad: Device = { id: 1, label: 'Her iPad', createdAt: '2026-10-19T12:00:00Z', revokedAt: null }

test('makes a code for a named iPad and counts it down', async ({ page }) => {
  await page.clock.install()
  await parentApi(page, [])
  await page.goto('/parent')
  await expect(page.getByRole('heading', { name: 'macworx · Parent' })).toBeVisible()
  await expect(page.getByText('No iPads paired yet.')).toBeVisible()
  await page.getByLabel('iPad name').fill('Her iPad')
  await page.getByRole('button', { name: 'Make a code' }).click()
  await expect(page.getByText('012 345')).toBeVisible()
  await expect(page.getByText('Enter it on the iPad within 10 minutes.')).toBeVisible()
  await page.clock.fastForward('09:30')
  await expect(page.getByText('Enter it on the iPad within 1 minute.')).toBeVisible()
  await page.clock.fastForward('01:00')
  await expect(page.getByText('This code has run out. Make a new one.')).toBeVisible()
})

test('asks for a name before making a code', async ({ page }) => {
  const calls = await parentApi(page, [])
  await page.goto('/parent')
  await page.getByRole('button', { name: 'Make a code' }).click()
  await expect(page.getByText('Give the iPad a name of up to 40 characters.')).toBeVisible()
  expect(calls.filter((c) => c.startsWith('POST'))).toEqual([])
})

test('unpairs an iPad after the warning, and keeps it when asked', async ({ page }) => {
  const calls = await parentApi(page, [herIpad])
  await page.goto('/parent')
  await expect(page.getByText('Paired Oct 19')).toBeVisible()

  await page.getByRole('button', { name: 'Unpair' }).click()
  const warning = "Unpair Her iPad? Results this iPad hasn't sent yet won't be saved."
  await expect(page.getByRole('alertdialog').getByText(warning)).toBeVisible()
  await page.getByRole('button', { name: 'Keep it paired' }).click()
  expect(calls).not.toContain('DELETE /api/parent/devices/1')

  await page.getByRole('button', { name: 'Unpair' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Unpair' }).click()
  await expect(page.getByText('Unpaired Oct 20')).toBeVisible()
  expect(calls).toContain('DELETE /api/parent/devices/1')
  await expect(page.getByRole('button', { name: 'Unpair' })).toHaveCount(0)
})

test('the Worker refusing (as on a preview) shows a message and never reloads', async ({ page }) => {
  await page.route('/api/parent/**', (route) =>
    route.fulfill({ status: 401, json: { error: 'unauthorized' } }),
  )
  let loads = 0
  page.on('load', () => loads++)
  await page.goto('/parent')
  await expect(page.getByRole('alert')).toHaveText('Something went wrong on our side. Try again in a minute.')
  await expect(page.getByLabel('Her numbers so far').getByText('—')).toHaveCount(4)
  await expect(page.getByText('Loading…')).toHaveCount(0)
  await expect(page.getByText('Not available right now.')).toHaveCount(3)
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
  await page.goto('/parent')
  const strip = page.getByLabel('Her numbers so far')
  await expect(strip.getByText('41')).toBeVisible()
  await expect(strip.getByText('3 days')).toBeVisible()
  await expect(strip.getByText('Oct 16')).toBeVisible()
  await expect(strip.getByText('5', { exact: true })).toBeVisible()

  const results = page.getByRole('table').first()
  await expect(results.getByRole('row')).toHaveCount(3)
  await expect(results.getByRole('row').nth(1)).toHaveText(/Oct 167 of 8Left early7/)
  await expect(results.getByRole('row').nth(2)).toHaveText(/Oct 1518 of 20Great22/)

  const log = page.getByRole('table').nth(1)
  await expect(log.getByText('Unpaired Her iPad')).toBeVisible()
  await expect(log.getByText('Made a pairing code for Her iPad')).toBeVisible()
  await expect(log.getByText('mum@example.com')).toBeVisible()
})

test('says so when there are no results or log entries yet', async ({ page }) => {
  await parentApi(page, [])
  await page.goto('/parent')
  await expect(page.getByText('No results yet.')).toBeVisible()
  await expect(page.getByText('Nothing here yet.')).toBeVisible()
  await expect(page.getByRole('table')).toHaveCount(0)
})

test('a new child shows no last counted day', async ({ page }) => {
  await page.route('/api/parent/**', (route) =>
    route.fulfill({
      json: readViews(new URL(route.request().url()).pathname, [], {
        '/api/parent/summary': { balance: 0, streak: 0, lastDay: null, completed: 0 },
      }),
    }),
  )
  await page.goto('/parent')
  await expect(page.getByText('None yet')).toBeVisible()
})

test('her app at / never shows the parent page', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
  await expect(page.getByText('macworx · Parent')).toHaveCount(0)
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
  await page.goto('/parent')
  await expect(page.getByText('Paired Oct 19')).toBeVisible()
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
  await page.goto('/parent')
  await expect(page.getByRole('alert')).toBeVisible()
  fail = false
  await page.getByLabel('iPad name').fill('Her iPad')
  await page.getByRole('button', { name: 'Make a code' }).click()
  await expect(page.getByText('111 222')).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('Make a code waits for its answer before taking another click', async ({ page }) => {
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
  await page.goto('/parent')
  await page.getByLabel('iPad name').fill('Her iPad')
  await page.getByRole('button', { name: 'Make a code' }).click()
  await expect(page.getByRole('button', { name: 'Make a code' })).toBeDisabled()
  answer()
  await expect(page.getByText('333 444')).toBeVisible()
  expect(posts).toHaveLength(1)
})

test('adds Macaronis with a note, then removes some', async ({ page }) => {
  const calls = await parentApi(page, [])
  await page.goto('/parent')
  const strip = page.getByLabel('Her numbers so far')
  await expect(strip.getByText('41')).toBeVisible()

  await page.getByLabel('How many Macaronis').fill('20')
  await page.getByLabel('Note').fill('Homework grades')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status')).toHaveText('Saved. Her balance is now 61.')
  await expect(strip.getByText('61')).toBeVisible()
  await expect(page.getByLabel('How many Macaronis')).toHaveValue('')

  await page.getByRole('button', { name: 'Remove' }).click()
  await page.getByLabel('How many Macaronis').fill('1')
  await page.getByLabel('Note').fill('Counted twice')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status')).toHaveText('Saved. Her balance is now 60.')
  expect(calls.filter((c) => c.startsWith('POST'))).toEqual([
    'POST /api/parent/balance',
    'POST /api/parent/balance',
  ])
})

test('asks for a whole number and a note before saving', async ({ page }) => {
  const calls = await parentApi(page, [])
  await page.goto('/parent')
  await page.getByLabel('Note').fill('A note')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('alert')).toHaveText('Enter a whole number of Macaronis, from 1 to 100,000.')
  await page.getByLabel('How many Macaronis').fill('2.5')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('alert')).toHaveText('Enter a whole number of Macaronis, from 1 to 100,000.')
  await page.getByLabel('How many Macaronis').fill('5')
  await page.getByLabel('Note').fill('   ')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('alert')).toHaveText(
    'Add a short note, up to 200 characters, so you remember why.',
  )
  expect(calls.filter((c) => c.startsWith('POST'))).toEqual([])
})

test('refuses taking away more than she has, in friendly words', async ({ page }) => {
  await parentApi(page, [])
  await page.goto('/parent')
  await page.getByRole('button', { name: 'Remove' }).click()
  await page.getByLabel('How many Macaronis').fill('50')
  await page.getByLabel('Note').fill('Too many')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('alert')).toHaveText(
    "She has 41 Macaronis, so you can't remove more than that. Her balance can't go below 0.",
  )
  await expect(page.getByLabel('Her numbers so far').getByText('41')).toBeVisible()
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
  await page.goto('/parent')
  await expect(page.getByText('Removed 5 Macaronis: Counted twice')).toBeVisible()
  await expect(page.getByText('Added 20 Macaronis: Homework grades')).toBeVisible()
})
