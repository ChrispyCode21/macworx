import { expect, test, type Page } from '@playwright/test'

// The Content screen's Edit list dialog (SPEC §5.3): search, edit with a pencil, delete with an [x] that asks first.
// /api/parent is answered by the test, which keeps the word list.

interface Word {
  id: number
  word: string
  sentence: string
  alternates: string[]
  grade: number | null
}

async function api(page: Page, words: Word[], gate: Promise<void> = Promise.resolve()) {
  const patches: unknown[] = []
  const deletes: number[] = []
  await page.route('/api/parent/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const word = url.pathname.match(/^\/api\/parent\/words\/(\d+)$/)
    if (url.pathname === '/api/parent/words' && request.method() === 'GET')
      return route.fulfill({ json: { words } })
    if (word && request.method() === 'PATCH') {
      const body = request.postDataJSON() as Partial<Word>
      patches.push(body)
      if (body.word?.toLowerCase() === 'friend')
        return route.fulfill({ status: 409, json: { error: 'duplicate' } })
      const found = words.find((w) => w.id === Number(word[1]))!
      Object.assign(found, body)
      return route.fulfill({ json: { word: found } })
    }
    if (word && request.method() === 'DELETE') {
      deletes.push(Number(word[1]))
      await gate
      words.splice(
        words.findIndex((w) => w.id === Number(word[1])),
        1,
      )
      return route.fulfill({ json: { ok: true } })
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
  return { patches, deletes }
}

const list = (): Word[] => [
  { id: 1, word: 'because', sentence: '', alternates: [], grade: null },
  { id: 2, word: 'favourite', sentence: 'My favourite colour.', alternates: ['favorite'], grade: null },
  { id: 3, word: 'friend', sentence: '', alternates: [], grade: null },
]

test('the dialog lists the words, searches them, edits one and shows a clash in plain words', async ({
  page,
}) => {
  const { patches } = await api(page, list())
  await page.goto('/parent/content')
  await page.getByRole('button', { name: 'Edit list' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit list' })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('.edit-list-word')).toHaveText(['because', 'favourite', 'friend'])
  await expect(dialog.getByText('Also right: favorite')).toBeVisible()

  // The search matches an alternate and a sentence, ignoring capitals.
  await dialog.getByRole('searchbox', { name: 'Search the list' }).fill('FAVOR')
  await expect(dialog.locator('.edit-list-word')).toHaveText(['favourite'])
  await dialog.getByRole('searchbox', { name: 'Search the list' }).fill('colour')
  await expect(dialog.locator('.edit-list-word')).toHaveText(['favourite'])
  await dialog.getByRole('searchbox', { name: 'Search the list' }).fill('zzz')
  await expect(dialog.getByText('No words match.')).toBeVisible()
  await dialog.getByRole('searchbox', { name: 'Search the list' }).fill('')

  await dialog.getByRole('button', { name: 'Edit because' }).click()
  await dialog.getByLabel('Sentence').fill('Because I said so.')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog.getByText('Because I said so.')).toBeVisible()
  expect(patches).toEqual([{ word: 'because', sentence: 'Because I said so.', alternates: [] }])

  // A word the Worker says is already there.
  await dialog.getByRole('button', { name: 'Edit favourite' }).click()
  await dialog.getByLabel('Word', { exact: true }).fill('Friend')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog.getByText('That word is already in the list.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog.getByRole('button', { name: 'Edit favourite' })).toBeVisible()
})

test('the [x] asks first: Keep leaves the word, Delete removes it, and Escape closes with focus back on Edit list', async ({
  page,
}) => {
  const { deletes } = await api(page, list())
  await page.goto('/parent/content')
  const open = page.getByRole('button', { name: 'Edit list' })
  await open.click()
  const dialog = page.getByRole('dialog', { name: 'Edit list' })

  await dialog.getByRole('button', { name: 'Delete because' }).click()
  await expect(dialog.getByText('Delete "because"?')).toBeVisible()
  await dialog.getByRole('button', { name: 'Keep' }).click()
  await expect(dialog.locator('.edit-list-word')).toHaveCount(3)
  expect(deletes).toEqual([])

  await dialog.getByRole('button', { name: 'Delete because' }).click()
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(dialog.locator('.edit-list-word')).toHaveText(['favourite', 'friend'])
  expect(deletes).toEqual([1])

  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(open).toBeFocused()
})

test('with no words it says so, and when the list cannot be read it says it is not available', async ({
  page,
}) => {
  await api(page, [])
  await page.goto('/parent/content')
  await page.getByRole('button', { name: 'Edit list' }).click()
  await expect(page.getByText('No words yet.')).toBeVisible()
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()

  await page.route('/api/parent/words', (route) => route.fulfill({ status: 500, body: 'oops' }))
  await page.getByRole('button', { name: 'Edit list' }).click()
  await expect(page.getByRole('dialog').getByText('Not available right now.')).toBeVisible()
})

test('Escape ends an edit first and the dialog second, and a padding click or a drag out of a box does not close it', async ({
  page,
}) => {
  await api(page, list())
  await page.goto('/parent/content')
  await page.getByRole('button', { name: 'Edit list' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit list' })

  await dialog.getByRole('button', { name: 'Edit because' }).click()
  // The Word box has focus as soon as the form opens.
  await expect(dialog.getByLabel('Word', { exact: true })).toBeFocused()
  await dialog.getByLabel('Sentence').fill('Typed, not saved.')
  // A click in the dialog's own padding is not a click outside it.
  await dialog.click({ position: { x: 4, y: 4 } })
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByLabel('Sentence')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Edit because' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  // The backdrop does close it.
  await page.getByRole('button', { name: 'Edit list' }).click()
  await expect(dialog).toBeVisible()
  await page.mouse.click(2, 2)
  await expect(dialog).toBeHidden()
})

test('the delete question takes focus on Keep, and while a delete is in flight neither button can be pressed', async ({
  page,
}) => {
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => (release = resolve))
  const { deletes } = await api(page, list(), gate)
  await page.goto('/parent/content')
  await page.getByRole('button', { name: 'Edit list' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit list' })

  await dialog.getByRole('button', { name: 'Delete because' }).click()
  await expect(dialog.getByRole('button', { name: 'Keep' })).toBeFocused()
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'Delete', exact: true })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: 'Keep' })).toBeDisabled()
  release()
  await expect(dialog.locator('.edit-list-word')).toHaveText(['favourite', 'friend'])
  expect(deletes).toEqual([1])
})

test('a word being edited stays in the list when the search stops matching it, and a rename moves it to its place', async ({
  page,
}) => {
  await api(page, list())
  await page.goto('/parent/content')
  await page.getByRole('button', { name: 'Edit list' }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit list' })

  await dialog.getByRole('button', { name: 'Edit because' }).click()
  await dialog.getByRole('searchbox', { name: 'Search the list' }).fill('zzz')
  await expect(dialog.getByLabel('Word', { exact: true })).toHaveValue('because')
  await dialog.getByRole('searchbox', { name: 'Search the list' }).fill('')
  await dialog.getByLabel('Word', { exact: true }).fill('zebra')
  await dialog.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(dialog.locator('.edit-list-word')).toHaveText(['favourite', 'friend', 'zebra'])
  await expect(dialog.getByRole('button', { name: 'Edit zebra' })).toBeFocused()
})
