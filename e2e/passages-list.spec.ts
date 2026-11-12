import { expect, test, type Page } from '@playwright/test'

// The Content screen's saved passages (SPEC §5.3, §6.10): the list, Edit (the JSON goes into the box and Save replaces
// the passage) and Delete (asks first; a passage that has been read can't be deleted). /api/parent is answered by the
// test, which keeps the list.

interface Row {
  id: number
  title: string
  minutes: number
  questions: number
  timesRead: number
}

const json = (title: string) => ({
  title,
  minutes: 2,
  passage: ['Mia plants a seed.'],
  questions: [
    {
      question: 'What does Mia plant?',
      options: ['A seed', 'A tree', 'A flower', 'A bush'],
      correct_answer: 'A seed',
    },
  ],
})

type Answer = { status: number; json: unknown }
const ok: Answer = { status: 200, json: { ok: true } }

async function api(
  page: Page,
  rows: Row[],
  onDelete: (id: number) => Answer,
  onPut: (id: number) => Answer = (id) => ({ status: 200, json: { id } }),
  gate: Promise<void> = Promise.resolve(),
) {
  const puts: unknown[] = []
  const deletes: number[] = []
  await page.route('/api/parent/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const one = url.pathname.match(/^\/api\/parent\/passages\/(\d+)$/)
    if (url.pathname === '/api/parent/passages' && request.method() === 'GET')
      return route.fulfill({ json: { passages: rows } })
    if (one && request.method() === 'GET')
      return route.fulfill({ json: { passage: json(rows.find((r) => r.id === Number(one[1]))!.title) } })
    if (one && request.method() === 'PUT') {
      puts.push({ id: Number(one[1]), ...(request.postDataJSON() as object) })
      await gate
      return route.fulfill(onPut(Number(one[1])))
    }
    if (one && request.method() === 'DELETE') {
      deletes.push(Number(one[1]))
      const answer = onDelete(Number(one[1]))
      if (answer.status === 200)
        rows.splice(
          rows.findIndex((r) => r.id === Number(one[1])),
          1,
        )
      return route.fulfill(answer)
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
  return { puts, deletes }
}

const rows = (): Row[] => [
  { id: 1, title: 'The Little Seed', minutes: 2, questions: 1, timesRead: 3 },
  { id: 2, title: 'Night Sky', minutes: 5, questions: 10, timesRead: 0 },
]
const box = (page: Page) => page.getByLabel('Passage JSON')

test('lists the saved passages with their minutes, questions and times read', async ({ page }) => {
  await api(page, rows(), () => ({ status: 200, json: { ok: true } }))
  await page.goto('/parent/content')
  await expect(page.getByText('The Little Seed', { exact: true })).toBeVisible()
  await expect(page.getByText('2 min · 1 question · read 3 times')).toBeVisible()
  await expect(page.getByText('5 min · 10 questions · read 0 times')).toBeVisible()
})

test('Edit puts the passage JSON in the box, and Save changes replaces it', async ({ page }) => {
  const { puts } = await api(page, rows(), () => ({ status: 200, json: { ok: true } }))
  await page.goto('/parent/content')
  await page.getByRole('button', { name: 'Edit Night Sky' }).click()
  await expect(page.getByText('Editing "Night Sky"')).toBeVisible()
  await expect(box(page)).toHaveValue(/"title": "Night Sky"/)
  await expect(page.getByRole('button', { name: 'Save passage' })).toHaveCount(0)

  await box(page).fill(JSON.stringify({ ...json('Night Sky'), minutes: 9 }))
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Saved your changes to "Night Sky".')).toBeVisible()
  await expect(box(page)).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Save passage' })).toBeVisible()
  expect(puts).toEqual([{ id: 2, passage: { ...json('Night Sky'), minutes: 9 } }])
})

test('Cancel leaves editing and empties the box without saving', async ({ page }) => {
  const { puts } = await api(page, rows(), () => ({ status: 200, json: { ok: true } }))
  await page.goto('/parent/content')
  await page.getByRole('button', { name: 'Edit The Little Seed' }).click()
  await expect(box(page)).not.toHaveValue('')
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(box(page)).toHaveValue('')
  await expect(page.getByText('Editing "The Little Seed"')).toHaveCount(0)
  expect(puts).toEqual([])
})

test('Delete asks first: Keep leaves it, Delete removes it from the list', async ({ page }) => {
  const { deletes } = await api(page, rows(), () => ({ status: 200, json: { ok: true } }))
  await page.goto('/parent/content')
  await page.getByRole('button', { name: 'Delete Night Sky' }).click()
  await expect(page.getByText('Delete "Night Sky"?')).toBeVisible()
  await page.getByRole('button', { name: 'Keep' }).click()
  await expect(page.getByText('Night Sky', { exact: true })).toBeVisible()
  expect(deletes).toEqual([])

  await page.getByRole('button', { name: 'Delete Night Sky' }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByText('Deleted "Night Sky".')).toBeVisible()
  await expect(page.getByText('5 min · 10 questions')).toHaveCount(0)
  expect(deletes).toEqual([2])
})

test('a passage that has been read says it can’t be deleted, and stays', async ({ page }) => {
  await api(page, rows(), () => ({ status: 409, json: { error: 'has_results' } }))
  await page.goto('/parent/content')
  await page.getByRole('button', { name: 'Delete The Little Seed' }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByText("This passage has been read, so it can't be deleted.")).toBeVisible()
  await expect(page.getByText('2 min · 1 question · read 3 times')).toBeVisible()
})

test('deleting the passage that is open in the box empties the box', async ({ page }) => {
  await api(page, rows(), () => ({ status: 200, json: { ok: true } }))
  await page.goto('/parent/content')
  await page.getByRole('button', { name: 'Edit Night Sky' }).click()
  await expect(box(page)).not.toHaveValue('')
  await page.getByRole('button', { name: 'Delete Night Sky' }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(box(page)).toHaveValue('')
  await expect(page.getByText('Editing "Night Sky"')).toHaveCount(0)
})

test('the pencils wait while the box has text, and say why, so nothing typed is lost', async ({ page }) => {
  await api(page, rows(), () => ok)
  await page.goto('/parent/content')
  await expect(page.getByRole('button', { name: 'Edit Night Sky' })).toBeEnabled()
  await box(page).fill('{"title": "Typed by hand"')
  await expect(page.getByRole('button', { name: 'Edit Night Sky' })).toBeDisabled()
  await expect(
    page.getByText("Save or cancel what's in the box before opening another passage."),
  ).toBeVisible()
  await box(page).fill('')
  await expect(page.getByRole('button', { name: 'Edit Night Sky' })).toBeEnabled()
})

test('typing while Save changes is on its way keeps it an edit, so the next Save replaces, not adds', async ({
  page,
}) => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => (release = resolve))
  const { puts } = await api(
    page,
    rows(),
    () => ok,
    (id) => ({ status: 200, json: { id } }),
    gate,
  )
  await page.goto('/parent/content')
  await page.getByRole('button', { name: 'Edit Night Sky' }).click()
  await expect(page.getByText('Editing "Night Sky"')).toBeVisible()
  await box(page).fill(JSON.stringify({ ...json('Night Sky'), minutes: 8 }))
  await page.getByRole('button', { name: 'Save changes' }).click()
  await box(page).fill(JSON.stringify({ ...json('Night Sky'), minutes: 9 }))
  release()
  await expect(page.getByText('Saved your changes to "Night Sky".')).toBeVisible()
  await expect(box(page)).toHaveValue(/"minutes":9/)
  await expect(page.getByText('Editing "Night Sky"')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible()
  expect(puts).toHaveLength(1)
})

test('Cancel waits while a save is on its way', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => (release = resolve))
  await api(
    page,
    rows(),
    () => ok,
    (id) => ({ status: 200, json: { id } }),
    gate,
  )
  await page.goto('/parent/content')
  await page.getByRole('button', { name: 'Edit Night Sky' }).click()
  await expect(page.getByText('Editing "Night Sky"')).toBeVisible()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  release()
  await expect(page.getByText('Saved your changes to "Night Sky".')).toBeVisible()
})

test('a passage that is gone when Save changes is sent: the text stays, as a new passage', async ({
  page,
}) => {
  await api(
    page,
    rows(),
    () => ok,
    () => ({ status: 404, json: { error: 'unknown_passage' } }),
  )
  await page.goto('/parent/content')
  await page.getByRole('button', { name: 'Edit Night Sky' }).click()
  await expect(page.getByText('Editing "Night Sky"')).toBeVisible()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('That passage is no longer in the list.')).toBeVisible()
  await expect(page.getByText('Editing "Night Sky"')).toHaveCount(0)
  await expect(box(page)).toHaveValue(/Night Sky/)
  await expect(page.getByRole('button', { name: 'Save passage' })).toBeVisible()
})

test('deleting a passage that is already gone drops it from the list', async ({ page }) => {
  const list = rows()
  await api(page, list, () => ({ status: 404, json: { error: 'unknown_passage' } }))
  await page.goto('/parent/content')
  await page.getByRole('button', { name: 'Delete Night Sky' }).click()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.getByText('That passage is no longer in the list.')).toBeVisible()
})

test('focus goes back to the row after Keep, and to the box after Cancel', async ({ page }) => {
  await api(page, rows(), () => ok)
  await page.goto('/parent/content')
  await page.getByRole('button', { name: 'Delete Night Sky' }).click()
  await page.getByRole('button', { name: 'Keep' }).click()
  await expect(page.getByRole('button', { name: 'Delete Night Sky' })).toBeFocused()

  await page.getByRole('button', { name: 'Edit Night Sky' }).click()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(box(page)).toBeFocused()
})
