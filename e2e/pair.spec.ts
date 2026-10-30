import { expect, test, type Page } from '@playwright/test'

// Pairing her device (SPEC §5.4), with the Worker's /api/pair and /api/state answered by the test.
// The service worker is blocked (playwright.config.ts), so these routes reach the test, not a cache.

/** Makes the app see itself as installed from the home screen. */
async function asInstalledApp(page: Page) {
  await page.addInitScript(() => Object.defineProperty(navigator, 'standalone', { value: true }))
}

async function typeCode(page: Page, code: string) {
  await expect(page.locator('.pad[data-ready]')).toBeVisible()
  for (const digit of code) await page.getByRole('button', { name: digit, exact: true }).click()
}

test('pairs the installed app with a code, and the button goes away', async ({ page }) => {
  await asInstalledApp(page)
  let sent: unknown
  await page.route('/api/pair', async (route) => {
    sent = route.request().postDataJSON()
    await route.fulfill({ status: 201, json: { key: 'test-device-key-0123456789' } })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Pair this device' }).click()
  await expect(page.getByText('Ask a grown-up for the 6-digit code, then type it here.')).toBeVisible()
  await typeCode(page, '012345')
  await expect(page.locator('.code-boxes')).toHaveAttribute('data-typed', '012345')
  await page.getByRole('button', { name: 'Pair', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'This device is paired!' })).toBeVisible()
  expect(sent).toEqual({ code: '012345' })
  await page.getByRole('button', { name: 'Done' }).click()
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pair this device' })).toHaveCount(0)
})

for (const [status, line] of [
  [400, "Hmm, that code isn't working. Ask a grown-up for a new one."],
  [429, "Let's wait a minute, then try again."],
  [503, "Something's busy right now. Try again in a minute."],
] as const) {
  test(`a ${status} answer shows a friendly line and clears the boxes`, async ({ page }) => {
    await asInstalledApp(page)
    await page.route('/api/pair', (route) => route.fulfill({ status, json: { error: 'x' } }))
    await page.goto('/')
    await page.getByRole('button', { name: 'Pair this device' }).click()
    await typeCode(page, '123456')
    await page.getByRole('button', { name: 'Pair', exact: true }).click()
    await expect(page.getByText(line)).toBeVisible()
    await expect(page.locator('.code-boxes')).toHaveAttribute('data-typed', '')
  })
}

test('with no connection, says to connect to Wi-Fi', async ({ page }) => {
  await asInstalledApp(page)
  await page.route('/api/pair', (route) => route.abort('internetdisconnected'))
  await page.goto('/')
  await page.getByRole('button', { name: 'Pair this device' }).click()
  await typeCode(page, '123456')
  await page.getByRole('button', { name: 'Pair', exact: true }).click()
  await expect(page.getByText('Connect to Wi-Fi to pair this device.')).toBeVisible()
})

test('Pair stays off until all six digits are in', async ({ page }) => {
  await asInstalledApp(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Pair this device' }).click()
  await typeCode(page, '12345')
  await expect(page.getByRole('button', { name: 'Pair', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
})

test('a Safari tab never offers pairing', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pair this device' })).toHaveCount(0)
})

test('a key the Worker no longer accepts is forgotten, and the button comes back', async ({ page }) => {
  await asInstalledApp(page)
  await page.addInitScript(() => localStorage.setItem('macworx.deviceKey', 'unpaired-key-0123456789'))
  await page.route('/api/*', (route) => route.fulfill({ status: 401, json: { error: 'unauthorized' } }))
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Pair this device' })).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('macworx.deviceKey'))).toBeNull()
})

test('a key that still works keeps the button hidden', async ({ page }) => {
  await asInstalledApp(page)
  await page.addInitScript(() => localStorage.setItem('macworx.deviceKey', 'paired-key-0123456789'))
  const checked = page.waitForRequest('/api/seeds')
  await page.route('/api/seeds', (route) => route.fulfill({ status: 200, json: { seeds: [1] } }))
  await page.route('/api/state', (route) => route.fulfill({ status: 200, json: {} }))
  await page.goto('/')
  expect((await checked).headers().authorization).toBe('Bearer paired-key-0123456789')
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Pair this device' })).toHaveCount(0)
})

test('Back waits while a code is on its way', async ({ page }) => {
  await asInstalledApp(page)
  let answer: () => void = () => {}
  await page.route('/api/pair', (route) => {
    answer = () => void route.fulfill({ status: 201, json: { key: 'late-key-0123456789' } })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Pair this device' }).click()
  await typeCode(page, '123456')
  await page.getByRole('button', { name: 'Pair', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Back' })).toBeDisabled()
  answer()
  await expect(page.getByRole('heading', { name: 'This device is paired!' })).toBeVisible()
})

test('a paired device with no seeds and no connection asks for Wi-Fi', async ({ page }) => {
  await asInstalledApp(page)
  await page.addInitScript(() => localStorage.setItem('macworx.deviceKey', 'paired-key-0123456789'))
  await page.route('/api/*', (route) => route.abort('internetdisconnected'))
  await page.goto('/')
  await page.getByRole('button', { name: 'Start' }).click()
  await expect(page.getByText('Connect to Wi-Fi to get more problems!')).toBeVisible()
})
