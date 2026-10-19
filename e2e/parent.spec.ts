import { expect, test, type Page, type Route } from '@playwright/test'

// The parent page at /parent (SPEC §5.3), with /api/parent answered by the test. Access itself isn't here:
// these check what the page does with the Worker's answers, and with Access's sign-in redirect.

interface Device {
  id: number
  label: string
  createdAt: string
  revokedAt: string | null
}

async function parentApi(page: Page, devices: Device[], code = '012345') {
  const calls: string[] = []
  await page.route('/api/parent/**', async (route: Route) => {
    const req = route.request()
    calls.push(`${req.method()} ${new URL(req.url()).pathname}`)
    if (req.method() === 'GET') return route.fulfill({ json: { devices } })
    if (req.method() === 'DELETE') {
      const id = Number(new URL(req.url()).pathname.split('/').pop())
      devices = devices.map((d) => (d.id === id ? { ...d, revokedAt: '2026-10-20T12:00:00Z' } : d))
      return route.fulfill({ json: { ok: true } })
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

test('her app at / never shows the parent page', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
  await expect(page.getByText('macworx · Parent')).toHaveCount(0)
})
