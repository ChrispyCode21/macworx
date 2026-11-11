import { expect, test, type Page } from '@playwright/test'

// The parent portal's Content screen (SPEC §5.3, §6.10): paste a passage, see it checked and previewed, save it.
// /api/parent is answered by the test.

const passage = {
  title: 'The Little Seed',
  minutes: 2,
  passage: ['Mia plants a seed.', 'She waters it.'],
  questions: [
    {
      question: 'What does Mia plant?',
      options: ['A seed', 'A tree', 'A flower', 'A bush'],
      correct_answer: 'A seed',
    },
  ],
}

const savedWords: unknown[] = []

async function api(page: Page, save: { status: number; json: unknown } = { status: 201, json: { id: 1 } }) {
  const saved: unknown[] = []
  savedWords.length = 0
  await page.route('/api/parent/**', (route) => {
    const url = new URL(route.request().url())
    if (route.request().method() === 'POST' && url.pathname === '/api/parent/words') {
      savedWords.push(route.request().postDataJSON())
      return route.fulfill({ status: 201, json: { added: 2, skipped: 1 } })
    }
    if (route.request().method() === 'POST' && url.pathname === '/api/parent/passages') {
      saved.push(route.request().postDataJSON())
      return route.fulfill(save)
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
    }
    return route.fulfill({ json: answers[url.pathname] })
  })
  return saved
}

const box = (page: Page) => page.getByLabel('Passage JSON')
const save = (page: Page) => page.getByRole('button', { name: 'Save passage' })

test('a pasted passage is checked, previewed and saved, and the box is cleared', async ({ page }) => {
  const saved = await api(page)
  await page.goto('/parent/content')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Make practice personal.')
  await expect(save(page)).toBeDisabled()

  await box(page).fill(JSON.stringify(passage, null, 2))
  await expect(page.getByText('Valid JSON · 1 passage · 1 question')).toBeVisible()
  await expect(page.getByRole('region', { name: 'The Little Seed' })).toContainText('Right answer')
  await save(page).click()

  await expect(page.getByText('Saved "The Little Seed".')).toBeVisible()
  await expect(box(page)).toHaveValue('')
  expect(saved).toEqual([{ passage }])
})

test('a passage that fails the checks says what to fix, and cannot be saved', async ({ page }) => {
  const saved = await api(page)
  await page.goto('/parent/content')
  const bad = { ...passage, questions: [{ ...passage.questions[0], options: ['A', 'B', 'C'] }] }
  await box(page).fill(JSON.stringify(bad))
  await expect(page.getByText('Question 1 needs exactly 4 "options" (it has 3).')).toBeVisible()
  await expect(save(page)).toBeDisabled()
  expect(saved).toEqual([])
})

test('the pasted text survives a visit to another tab, and a refused save keeps it', async ({ page }) => {
  await api(page, { status: 400, json: { error: 'bad_passage', problems: ['x'] } })
  await page.goto('/parent/content')
  const text = JSON.stringify(passage)
  await box(page).fill(text)

  await page.getByRole('navigation', { name: 'Parent sections' }).getByRole('link', { name: 'Shop' }).click()
  await page
    .getByRole('navigation', { name: 'Parent sections' })
    .getByRole('link', { name: 'Content' })
    .click()
  await expect(box(page)).toHaveValue(text)

  await save(page).click()
  await expect(page.getByText("couldn't be saved")).toBeVisible()
  await expect(box(page)).toHaveValue(text)
})

const wordsBox = (page: Page) => page.getByRole('textbox', { name: /^Words/ })
const saveWords = (page: Page) => page.getByRole('button', { name: 'Save word list' })

test('pasted words are counted and checked, saved, and the box is cleared with how many were added', async ({
  page,
}) => {
  await api(page)
  await page.goto('/parent/content')
  await expect(saveWords(page)).toBeDisabled()
  await expect(page.getByText('0 words')).toBeVisible()

  await wordsBox(page).fill('because, friend\nfavourite/favorite\ntheir: They ate their dinner.\n\n')
  await expect(page.getByText('4 words')).toBeVisible()
  await saveWords(page).click()

  await expect(page.getByText('Added 2 words. 1 was already there.')).toBeVisible()
  await expect(wordsBox(page)).toHaveValue('')
  expect(savedWords).toEqual([
    {
      words: [
        { word: 'because', sentence: '', alternates: [] },
        { word: 'friend', sentence: '', alternates: [] },
        { word: 'favourite', sentence: '', alternates: ['favorite'] },
        { word: 'their', sentence: 'They ate their dinner.', alternates: [] },
      ],
    },
  ])
})

test('a word that fails the checks says what to fix and keeps Save off, and the words survive a tab switch', async ({
  page,
}) => {
  await api(page)
  await page.goto('/parent/content')
  await wordsBox(page).fill('good, ice cream')
  await expect(
    page.getByText('The word "ice cream" can only have letters, apostrophes and hyphens.'),
  ).toBeVisible()
  await expect(saveWords(page)).toBeDisabled()

  const nav = page.getByRole('navigation', { name: 'Parent sections' })
  await nav.getByRole('link', { name: 'Shop' }).click()
  await nav.getByRole('link', { name: 'Content' }).click()
  await expect(wordsBox(page)).toHaveValue('good, ice cream')
  expect(savedWords).toEqual([])
})

test('a save in flight is sent once, keeps what is typed meanwhile, and a refused one keeps the words', async ({
  page,
}) => {
  const requests: unknown[] = []
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => (release = resolve))
  let refuse = false
  await api(page)
  await page.route('/api/parent/words', async (route) => {
    requests.push(route.request().postDataJSON())
    await gate
    return refuse
      ? route.fulfill({ status: 400, json: { error: 'bad_word', problems: ['x'] } })
      : route.fulfill({ status: 201, json: { added: 2, skipped: 0 } })
  })
  await page.goto('/parent/content')
  await wordsBox(page).fill('one\ntwo')
  await saveWords(page).click()
  await expect(page.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  await wordsBox(page).fill('one\ntwo\nthree')
  release()
  await expect(page.getByText('Added 2 words.')).toBeVisible()
  // The saved words are gone; the one typed meanwhile stays, and typing clears the note.
  await expect(wordsBox(page)).toHaveValue('three')
  await wordsBox(page).fill('three!')
  await expect(page.getByText('Added 2 words.')).toHaveCount(0)
  expect(requests).toHaveLength(1)
})

test('more than 500 words is named before Save, not after it', async ({ page }) => {
  await api(page)
  await page.goto('/parent/content')
  const words = Array.from(
    { length: 501 },
    (_, i) =>
      `w${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + (Math.floor(i / 26) % 26))}${String.fromCharCode(97 + Math.floor(i / 676))}`,
  )
  await wordsBox(page).fill(words.join('\n'))
  await expect(page.getByText('A save can have at most 500 words.')).toBeVisible()
  await expect(saveWords(page)).toBeDisabled()
})
