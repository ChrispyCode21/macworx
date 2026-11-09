import { expect, test, type Page } from '@playwright/test'

// A paid reading assignment on a paired iPad (SPEC §5.6): the happy path, with the Worker mocked.
const KEY = 'test-device-key-0123456789'
const choices = (q: number) => ['One', 'Two', 'Three', 'Four'].map((text, i) => ({ id: q * 10 + i, text }))
const passage = {
  id: 1,
  title: 'The Lighthouse',
  genre: '',
  minutes: 3,
  hint: '',
  paragraphs: ['First paragraph.', 'Second paragraph.'],
  image: null,
  questions: [1, 2, 3].map((q) => ({ id: q, text: `Question text ${q}?`, choices: choices(q) })),
}
const state = { balance: 125, streak: 1, lastDay: '2026-11-09', completed: 1, latestGrade: 'Great' }

test(
  'reads, answers in pairs, checks, and sees the result',
  { tag: '@portrait' },
  async ({ page }: { page: Page }) => {
    const posted: unknown[] = []
    await page.route('/api/**', (route) => {
      const path = new URL(route.request().url()).pathname
      if (path === '/api/reading/start') return route.fulfill({ json: { attempt: 9, passage } })
      if (path === '/api/reading/result') {
        posted.push(route.request().postDataJSON())
        return route.fulfill({
          status: 201,
          json: {
            result: {
              attempt: 9,
              day: '2026-11-09',
              answered: 3,
              correct: 2,
              finished: true,
              grade: 'Good',
              payout: { base: 20, accuracyBonus: 0, streakBonus: 5, total: 25 },
              questions: [
                { id: 1, right: true, rightChoice: 10, explanation: 'It says so in the first paragraph.' },
                { id: 2, right: false, rightChoice: 21, explanation: '' },
                { id: 3, right: true, rightChoice: 30, explanation: '' },
              ],
            },
            state,
          },
        })
      }
      if (path === '/api/seeds') return route.fulfill({ json: { seeds: [] } })
      return route.fulfill({ json: state })
    })
    await page.addInitScript((key) => localStorage.setItem('macworx.deviceKey', key), KEY)
    await page.goto('/')
    await page.getByRole('button', { name: 'Start Reading', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'The Lighthouse' })).toBeVisible()
    await expect(page.getByText('3 min read')).toBeVisible()
    const ready = () => expect(page.locator('.practice-buttons button[data-ready]').last()).toBeVisible()
    await ready()
    await page.getByRole('button', { name: 'Next', exact: true }).click()

    // Two at a time, four choices each, nothing marked.
    await expect(page.locator('.practice-question-card')).toHaveCount(2)
    await expect(page.getByRole('radio')).toHaveCount(8)
    await page.locator('.practice-question-card').nth(0).getByRole('radio').first().click()
    await page.locator('.practice-question-card').nth(1).getByRole('radio').nth(0).click()
    await expect(page.locator('[data-result]')).toHaveCount(0)
    await ready()
    await page.getByRole('button', { name: 'Next', exact: true }).click()

    // The odd last question comes alone; Check waits for every pick.
    await expect(page.locator('.practice-question-card')).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Check answers' })).toBeDisabled()
    await expect(page.getByText('Pick an answer for each question: 1 to go.')).toBeVisible()
    await page.getByRole('radio').first().click()
    const check = page.getByRole('button', { name: 'Check answers' })
    await expect(check).toBeEnabled()
    await ready()
    await check.click()

    await expect(page.locator('[data-result="right"]')).toHaveCount(1)
    await expect(page.locator('.response-lead')).toHaveText('The best answer is A. One')
    expect(posted).toEqual([
      {
        attempt: 9,
        day: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        picks: [
          { question: 1, choice: 10 },
          { question: 2, choice: 20 },
          { question: 3, choice: 30 },
        ],
      },
    ])
    await ready()
    await page.getByRole('button', { name: 'Done' }).click()
    await expect(page.getByText('2 of 3 right')).toBeVisible()
    await expect(page.getByText('25 Macaronis')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Do another one' })).toHaveCount(0)
  },
)
