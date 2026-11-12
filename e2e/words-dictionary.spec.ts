import { expect, test, type Page } from '@playwright/test'

// The Content screen's dictionary advice (SPEC §5.3, §6.11, E21): advice only, from the real US and UK
// dictionaries the built app fetches. /api/parent is answered by the test.

async function api(page: Page) {
  const saved: { words: { word: string; alternates: string[] }[] }[] = []
  await page.route('/api/parent/**', (route) => {
    const url = new URL(route.request().url())
    if (route.request().method() === 'POST' && url.pathname === '/api/parent/words') {
      saved.push(route.request().postDataJSON())
      return route.fulfill({ status: 201, json: { added: 2, skipped: 0 } })
    }
    const answers: Record<string, unknown> = {
      '/api/parent/children': { children: [{ id: 1, name: 'Ada', grade: '4', initials: 'A' }] },
      '/api/parent/summary': {
        balance: 0,
        streak: 0,
        lastDay: null,
        completed: 0,
        earnedToday: 0,
        completedToday: 0,
      },
      '/api/parent/days': { days: [] },
      '/api/parent/results': { results: [] },
      '/api/parent/log': { entries: [] },
      '/api/parent/devices': { devices: [] },
      '/api/parent/passages': { passages: [] },
    }
    return route.fulfill({ json: answers[url.pathname] })
  })
  return saved
}

const wordsBox = (page: Page) => page.getByRole('textbox', { name: /^Words/ })

test('E21: advice shows for a word in one dictionary or none, an added alternate is saved, and Save is never held', async ({
  page,
}) => {
  const saved = await api(page)
  await page.goto('/parent/content')
  await wordsBox(page).fill('colour\nxqzt\nbecause')
  await expect(page.getByText('"colour" is in the UK dictionary only. Also accept "color"?')).toBeVisible()
  await expect(
    page.getByText('"xqzt" isn\'t in the US or UK dictionary. Is it spelled the way you want?'),
  ).toBeVisible()
  await expect(page.getByText('"because"')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Save word list' })).toBeEnabled()

  await page.getByRole('button', { name: 'Add alternate for colour' }).click()
  await expect(page.getByText('"colour" is in the UK dictionary only. Also accepting "color".')).toBeVisible()
  await page.getByRole('button', { name: 'Save word list' }).click()
  await expect(page.getByText('Added 2 words.')).toBeVisible()
  expect(saved[0]!.words.map((w) => [w.word, w.alternates])).toEqual([
    ['colour', ['color']],
    ['xqzt', []],
    ['because', []],
  ])
  await expect(wordsBox(page)).toHaveValue('')
})

test('Remove takes an added alternate back, and one already typed on the line is not offered again', async ({
  page,
}) => {
  const saved = await api(page)
  await page.goto('/parent/content')
  await wordsBox(page).fill('colour\nfavourite/favorite')
  await page.getByRole('button', { name: 'Add alternate for colour' }).click()
  await page.getByRole('button', { name: 'Remove alternate for colour' }).click()
  await expect(page.getByText('"colour" is in the UK dictionary only. Also accept "color"?')).toBeVisible()
  await expect(page.getByText('"favourite"')).toHaveCount(0)
  await page.getByRole('button', { name: 'Save word list' }).click()
  await expect(page.getByText('Added 2 words.')).toBeVisible()
  expect(saved[0]!.words.map((w) => w.alternates)).toEqual([[], ['favorite']])
})

test('the dictionary code and files are fetched on the Content screen only, and are not in the offline files', async ({
  page,
  request,
}) => {
  await api(page)
  const fetched: string[] = []
  page.on('request', (r) => fetched.push(new URL(r.url()).pathname))
  await page.goto('/parent/content')
  await wordsBox(page).fill('colour')
  await expect(page.getByText('"colour" is in the UK dictionary only.')).toBeVisible()
  const files = fetched.filter((path) => /\/dictionary-.*\.js$|\.aff$|\.dic$/.test(path))
  // The code and the two word lists (the two .aff files are the same file).
  expect(files.length).toBeGreaterThanOrEqual(3)
  const worker = await (await request.get('/sw.js')).text()
  for (const path of files) expect(worker).not.toContain(path.split('/').pop())
})
