import { expect, test, type Page } from '@playwright/test'

// Doing an assignment end to end (SPEC §5.1), in the production build.

const CHEERS = /^(You got it!|Yes!|Nice work!|That's right!)$/

async function noSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

/** Reads the stacked problem's numbers and returns its answer. */
async function currentAnswer(page: Page): Promise<number> {
  const problem = page.locator('.stacked')
  const [a, b, op] = await Promise.all([
    problem.getAttribute('data-a'),
    problem.getAttribute('data-b'),
    problem.getAttribute('data-operation'),
  ])
  const [x, y] = [Number(a), Number(b)]
  return op === 'addition' ? x + y : op === 'subtraction' ? x - y : x * y
}

/** The pad ignores taps for a moment after it appears (a double tap on Next); wait that out. */
async function padReady(page: Page) {
  await expect(page.locator('.pad[data-ready]')).toBeVisible()
}

/** Types a number on the pad and taps Check. */
async function answer(page: Page, value: number) {
  await padReady(page)
  for (const digit of String(value)) await page.getByRole('button', { name: digit, exact: true }).click()
  await page.getByRole('button', { name: 'Check' }).click()
}

test('finishes an assignment and sees the grade and Macaronis', async ({ page }) => {
  // About 100 taps; WebKit needs over 20 s for them, past the 30 s default once tests run in parallel.
  test.setTimeout(90_000)
  await page.goto('/')
  await page.getByRole('button', { name: 'Start' }).click()

  for (let n = 1; n <= 20; n++) {
    await expect(page.getByText(`Problem ${n} of 20`)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Check' })).toBeDisabled()
    const right = await currentAnswer(page)
    if (n === 3) {
      // One not right: the response shows how it works, never her answer.
      await answer(page, right + 1)
      await expect(page.getByText("Here's how that one works:", { exact: true })).toBeVisible()
      await expect(page.getByText('Keep going!', { exact: true })).toBeVisible()
    } else {
      await answer(page, right)
      await expect(page.locator('.response-lead')).toHaveText(CHEERS)
    }
    if (n === 1) await noSidewaysScroll(page)
    await page.getByRole('button', { name: n === 20 ? 'See how I did' : 'Next' }).click()
  }

  await expect(page.getByRole('heading', { name: 'Great work!' })).toBeVisible()
  await expect(page.getByText('19 of 20 right')).toBeVisible()
  await expect(page.locator('.result-macaronis')).toHaveText('19 + 3 bonus = 22 Macaronis')
  await expect(page.getByText('Macaronis start saving soon!')).toBeVisible()
  await noSidewaysScroll(page)

  await page.getByRole('button', { name: 'Do another one' }).click()
  await expect(page.getByText('Problem 1 of 20')).toBeVisible()
})

test('leaves partway and keeps the Macaronis earned so far', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start' }).click()
  for (let n = 1; n <= 2; n++) {
    await answer(page, await currentAnswer(page))
    await page.getByRole('button', { name: 'Next' }).click()
  }
  await page.getByRole('button', { name: 'Done for now' }).click()

  await expect(page.getByRole('heading', { name: 'You did 2 problems.' })).toBeVisible()
  await expect(page.locator('.result-macaronis')).toHaveText('2 Macaronis')
  await page.getByRole('button', { name: 'Home' }).click()
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
})

test('a quick second tap on Next does not type into the next problem', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start' }).click()
  await answer(page, await currentAnswer(page))
  const next = page.getByRole('button', { name: 'Next' })
  const box = (await next.boundingBox())!
  // Two taps at the same spot: the second lands wherever the pad now is.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(page.getByText('Problem 2 of 20')).toBeVisible()
  await expect(page.locator('.stacked-answer')).toHaveText(' ')
})

test('leaving before answering anything goes straight home', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start' }).click()
  await page.getByRole('button', { name: 'Done for now' }).click()
  await expect(page.getByRole('button', { name: 'Start' })).toBeVisible()
})

test('the delete key and a lone 0 work on the pad', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start' }).click()
  await padReady(page)
  await page.getByRole('button', { name: '7', exact: true }).click()
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('button', { name: 'Check' })).toBeDisabled()
  await page.getByRole('button', { name: '0', exact: true }).click()
  await expect(page.locator('.stacked-answer')).toHaveText('0')
  await expect(page.getByRole('button', { name: 'Check' })).toBeEnabled()
})
