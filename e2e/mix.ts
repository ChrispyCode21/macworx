import { expect, type Page } from '@playwright/test'

/** Opens the mix screen from Home's Math card. */
export async function openMix(page: Page) {
  await page.getByRole('button', { name: 'Start Math', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Make a math mix of your own.' })).toBeVisible()
}

/** Taps a cell of the mix grid, for example `pickCell(page, 'Addition', 'Medium')`. */
export async function pickCell(page: Page, operation: string, level: string) {
  await page.getByRole('button', { name: new RegExp(`, ${operation}, ${level}$`) }).click()
}

/** Starts a Math assignment of one level and operation (Addition Medium unless told) from Home. */
export async function startMath(page: Page, operation = 'Addition', level = 'Medium') {
  await openMix(page)
  await pickCell(page, operation, level)
  await page.getByRole('button', { name: 'Start 20 problems' }).click()
}
