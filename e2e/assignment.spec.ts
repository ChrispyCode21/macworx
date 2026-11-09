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

/** Types a number the way she would (SPEC §5.1) and taps Check: ones place first, except multiplication. */
async function answer(page: Page, value: number) {
  await padReady(page)
  const onesFirst = (await page.locator('.stacked').getAttribute('data-operation')) !== 'multiplication'
  const digits = onesFirst ? [...String(value)].reverse() : [...String(value)]
  for (const digit of digits) await page.getByRole('button', { name: digit, exact: true }).click()
  await expect(page.locator('.stacked')).toHaveAttribute('data-shown', String(value))
  await page.getByRole('button', { name: 'Check' }).click()
  await nextReady(page)
}

/** Next ignores taps for a moment after Check (a double tap on Check); wait that out. */
async function nextReady(page: Page) {
  await expect(page.locator('.practice-buttons button[data-ready]')).toBeVisible()
}

const FULL = { tag: '@full-assignment' }

test('finishes an assignment and sees the grade and Macaronis', FULL, async ({ page }) => {
  // About 100 taps; WebKit needs over 20 s for them, past the 30 s default once tests run in parallel.
  test.setTimeout(90_000)
  await page.goto('/')
  await page.getByRole('button', { name: 'Math', exact: true }).click()

  let padHeight = 0
  for (let n = 1; n <= 20; n++) {
    await expect(page.getByText(`Problem ${n} of 20`)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Check' })).toBeDisabled()
    const right = await currentAnswer(page)
    const problem = page.locator('.stacked')
    const padPanel = page.locator('.practice-panel-warm')
    if (n === 1) {
      await expect(page.getByText(/^(Addition|Subtraction|Multiplication) practice$/)).toBeVisible()
      await expect(page.getByText('Tap to enter your answer')).toBeVisible()
      padHeight = (await padPanel.boundingBox())?.height ?? 0
    }
    if (n === 3) {
      // One not right: her answer stays in her boxes, tinted coral; the right one is only in the response.
      await answer(page, right + 1)
      await expect(page.getByText("Here's how that one works:", { exact: true })).toBeVisible()
      await expect(page.getByText('Keep going!', { exact: true })).toBeVisible()
      await expect(problem).toHaveAttribute('data-shown', String(right + 1))
      await expect(problem).toHaveAttribute('data-outcome', 'notRight')
      await expect(page.locator('.answer-box-not-right').first()).toBeVisible()
      expect(Math.abs(((await padPanel.boundingBox())?.height ?? 0) - padHeight)).toBeLessThanOrEqual(1)
    } else {
      await answer(page, right)
      await expect(page.locator('.response-lead')).toHaveText(CHEERS)
      await expect(problem).toHaveAttribute('data-shown', String(right))
      await expect(problem).toHaveAttribute('data-outcome', 'right')
    }
    if (n === 1) {
      await noSidewaysScroll(page)
      // The response replaces the pad's contents in the same panel, at the same size.
      await expect(page.getByText('Tap to enter your answer')).toHaveCount(0)
      await expect(padPanel.locator('.response-lead')).toBeVisible()
      expect(Math.abs(((await padPanel.boundingBox())?.height ?? 0) - padHeight)).toBeLessThanOrEqual(1)
    }
    await page.getByRole('button', { name: n === 20 ? 'See how I did' : 'Next' }).click()
  }

  await expect(page.getByRole('heading', { name: 'Great work!' })).toBeVisible()
  await expect(page.getByText('19 of 20 right')).toBeVisible()
  await expect(page.locator('.result-macaronis')).toHaveText('19 + 3 bonus = 22 Macaronis')
  await expect(page.getByText('Macaronis start saving soon!')).toHaveCount(0)
  await noSidewaysScroll(page)

  await page.getByRole('button', { name: 'Do another one' }).click()
  await expect(page.getByText('Problem 1 of 20')).toBeVisible()
})

test('leaves partway and keeps the Macaronis earned so far', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Math', exact: true }).click()
  for (let n = 1; n <= 2; n++) {
    const problemPanel = page.locator('.practice-panel-problem')
    const padPanel = page.locator('.practice-panel-warm')
    let before = { x: 0, y: 0, width: 0, height: 0 }
    if (n === 1) {
      // Side by side from 1024px wide, stacked below that.
      const p = (await problemPanel.boundingBox())!
      before = (await padPanel.boundingBox())!
      const wide = (page.viewportSize()?.width ?? 0) >= 1024
      if (wide) expect(before.x).toBeGreaterThanOrEqual(p.x + p.width - 1)
      else expect(before.y).toBeGreaterThanOrEqual(p.y + p.height - 1)
    }
    await answer(page, await currentAnswer(page))
    // The problem screen with its response, in both orientations (the full assignment runs in landscape only).
    if (n === 1) {
      await noSidewaysScroll(page)
      await expect(padPanel.locator('.response-lead')).toBeVisible()
      expect(Math.abs(((await padPanel.boundingBox())?.height ?? 0) - before.height)).toBeLessThanOrEqual(1)
    }
    await page.getByRole('button', { name: 'Next' }).click()
  }
  await page.getByRole('button', { name: 'Done for now' }).click()

  await expect(page.getByRole('heading', { name: 'You did 2 problems.' })).toBeVisible()
  await expect(page.locator('.result-macaronis')).toHaveText('2 Macaronis')
  await noSidewaysScroll(page)
  await page.getByRole('button', { name: 'Home' }).click()
  await expect(page.getByRole('button', { name: 'Math', exact: true })).toBeVisible()
})

test('a tap on the pad right after Next does not type into the next problem', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Math', exact: true }).click()
  await padReady(page)
  const key = (await page.getByRole('button', { name: '5', exact: true }).boundingBox())!
  await answer(page, await currentAnswer(page))
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText('Problem 2 of 20')).toBeVisible()
  // The new pad ignores taps for a moment; this one lands on its 5 key straight away.
  await page.mouse.click(key.x + key.width / 2, key.y + key.height / 2)
  await expect(page.locator('.stacked')).toHaveAttribute('data-shown', '')
})

test('a quick double tap on Check leaves her response on screen', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Math', exact: true }).click()
  const right = await currentAnswer(page)
  await padReady(page)
  const onesFirst = (await page.locator('.stacked').getAttribute('data-operation')) !== 'multiplication'
  const digits = onesFirst ? [...String(right)].reverse() : [...String(right)]
  for (const digit of digits) await page.getByRole('button', { name: digit, exact: true }).click()
  const check = page.getByRole('button', { name: 'Check' })
  const box = (await check.boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  await expect(page.locator('.response-lead')).toBeVisible()
  await expect(page.getByText('Problem 1 of 20')).toBeVisible()
  // Once Next is ready, a tap moves on.
  await nextReady(page)
  await page.getByRole('button', { name: 'Next' }).click()
  await expect(page.getByText('Problem 2 of 20')).toBeVisible()
})

test('after Check, focus moves to Next', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Math', exact: true }).click()
  await answer(page, await currentAnswer(page))
  await expect(page.getByRole('button', { name: 'Next' })).toBeFocused()
})

test('leaving before answering anything goes straight home', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Math', exact: true }).click()
  await page.getByRole('button', { name: 'Done for now' }).click()
  await expect(page.getByRole('button', { name: 'Math', exact: true })).toBeVisible()
})

test('the delete key and a lone 0 work on the pad', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Math', exact: true }).click()
  await padReady(page)
  await page.getByRole('button', { name: '7', exact: true }).click()
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('button', { name: 'Check' })).toBeDisabled()
  await page.getByRole('button', { name: '0', exact: true }).click()
  await expect(page.locator('.stacked')).toHaveAttribute('data-shown', '0')
  await expect(page.getByRole('button', { name: 'Check' })).toBeEnabled()
})

test('leaving with none right hides the Macaroni line instead of showing 0', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Math', exact: true }).click()
  await answer(page, (await currentAnswer(page)) + 1)
  await expect(page.getByText("Here's how that one works:", { exact: true })).toBeVisible()
  await noSidewaysScroll(page)
  await page.getByRole('button', { name: 'Done for now' }).click()

  await expect(page.getByRole('heading', { name: 'You did 1 problem.' })).toBeVisible()
  await expect(page.locator('.result-macaronis')).toHaveCount(0)
})
