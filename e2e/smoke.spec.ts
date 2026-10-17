import { expect, test } from '@playwright/test'

// The production build loads on an iPad-sized screen and is installable (SPEC §2).

test('opens the app without sideways scrolling', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'macworx' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})

test('links a web app manifest for installing to the home screen', async ({ page, request }) => {
  await page.goto('/')
  const href = await page.locator('link[rel="manifest"]').getAttribute('href')
  expect(href).toBeTruthy()
  const manifest = await (await request.get(href!)).json()
  expect(manifest).toMatchObject({ name: 'macworx', display: 'standalone' })
})

test.describe('offline', () => {
  test.use({ serviceWorkers: 'allow' })

  test('opens with no connection once the service worker has installed', async ({ page, context }) => {
    await page.goto('/')
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await context.setOffline(true)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'macworx' })).toBeVisible()
  })
})
