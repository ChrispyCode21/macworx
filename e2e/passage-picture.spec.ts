import { expect, test, type Page } from '@playwright/test'

// The Content screen's picture box (SPEC §5.3, §6.10): "Upload or drag and drop", checked in plain words, and sent
// right after Save passage. /api/parent is answered by the test.

const passage = {
  title: 'The Little Seed',
  minutes: 2,
  passage: ['Mia plants a seed.'],
  questions: [
    {
      question: 'What does Mia plant?',
      options: ['A seed', 'A tree', 'A flower', 'A bush'],
      correct_answer: 'A seed',
    },
  ],
}
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const png = (extra = 100) => Buffer.from([...PNG, ...new Array(extra).fill(1)])

async function api(
  page: Page,
  picture: { status: number; json: unknown } = { status: 200, json: { image: '1.png' } },
  gate: Promise<void> = Promise.resolve(),
  rows: unknown[] = [],
) {
  const calls: { method: string; path: string; bytes?: number; type?: string }[] = []
  await page.route('/api/parent/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const one = url.pathname.match(/^\/api\/parent\/passages\/(\d+)$/)
    if (one && request.method() === 'GET') return route.fulfill({ json: { passage } })
    if (one && request.method() === 'PUT') {
      calls.push({ method: 'PUT', path: url.pathname })
      return route.fulfill({ json: { id: Number(one[1]) } })
    }
    if (url.pathname === '/api/parent/passages' && request.method() === 'POST') {
      calls.push({ method: 'POST', path: url.pathname })
      return route.fulfill({ status: 201, json: { id: 1 } })
    }
    if (/^\/api\/parent\/passages\/\d+\/image$/.test(url.pathname) && request.method() === 'PUT') {
      calls.push({
        method: 'PUT',
        path: url.pathname,
        bytes: request.postDataBuffer()?.length,
        type: request.headers()['content-type'],
      })
      await gate
      return route.fulfill(picture)
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
      '/api/parent/passages': { passages: rows },
    }
    return route.fulfill({ json: answers[url.pathname] })
  })
  return calls
}

const box = (page: Page) => page.getByLabel('Passage JSON')
const file = (page: Page) => page.locator('input[type="file"]')

async function paste(page: Page) {
  await box(page).fill(JSON.stringify(passage))
  await expect(page.getByText('Valid JSON · 1 passage · 1 question')).toBeVisible()
}

test('a chosen picture is named with its size, then sent right after the passage is saved', async ({
  page,
}) => {
  const calls = await api(page)
  await page.goto('/parent/content')
  await paste(page)
  await file(page).setInputFiles({ name: 'seed.png', mimeType: 'image/png', buffer: png() })
  await expect(page.getByText('seed.png (1 KB)')).toBeVisible()

  await page.getByRole('button', { name: 'Save passage' }).click()
  await expect(page.getByText('Saved "The Little Seed".')).toBeVisible()
  await expect(page.getByText('seed.png')).toHaveCount(0)
  await expect(box(page)).toHaveValue('')
  expect(calls.map((c) => [c.method, c.path, c.type])).toEqual([
    ['POST', '/api/parent/passages', undefined],
    ['PUT', '/api/parent/passages/1/image', 'image/png'],
  ])
  // WebKit does not show a binary body to the test; where it does, it is the whole file.
  const sent = calls[1]!.bytes
  expect(sent === undefined || sent === png().length).toBe(true)
})

test('a file that is not a picture is named in plain words, even called a.png, and is not kept', async ({
  page,
}) => {
  const calls = await api(page)
  await page.goto('/parent/content')
  await paste(page)
  await file(page).setInputFiles({
    name: 'a.png',
    mimeType: 'image/png',
    buffer: Buffer.from('hello, not a picture'),
  })
  await expect(page.getByText("That file isn't a PNG, JPEG or WebP picture.")).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove picture' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Save passage' }).click()
  await expect(page.getByText('Saved "The Little Seed".')).toBeVisible()
  expect(calls.map((c) => c.method)).toEqual(['POST'])
})

test('a picture over 2 MB is named, and exactly 2 MB is kept', async ({ page }) => {
  await api(page)
  await page.goto('/parent/content')
  await file(page).setInputFiles({
    name: 'big.png',
    mimeType: 'image/png',
    buffer: Buffer.concat([Buffer.from(PNG), Buffer.alloc(2 * 1024 * 1024 + 1 - PNG.length)]),
  })
  await expect(page.getByText('That picture is over 2 MB. Choose a smaller one.')).toBeVisible()
  await file(page).setInputFiles({
    name: 'edge.png',
    mimeType: 'image/png',
    buffer: Buffer.concat([Buffer.from(PNG), Buffer.alloc(2 * 1024 * 1024 - PNG.length)]),
  })
  await expect(page.getByText('edge.png (2.0 MB)')).toBeVisible()
  await expect(page.getByText('That picture is over 2 MB.')).toHaveCount(0)
})

test('Remove drops the chosen picture, and nothing is sent for it', async ({ page }) => {
  const calls = await api(page)
  await page.goto('/parent/content')
  await paste(page)
  await file(page).setInputFiles({ name: 'seed.png', mimeType: 'image/png', buffer: png() })
  await page.getByRole('button', { name: 'Remove picture' }).click()
  await expect(page.getByText('seed.png')).toHaveCount(0)
  await page.getByRole('button', { name: 'Save passage' }).click()
  await expect(page.getByText('Saved "The Little Seed".')).toBeVisible()
  expect(calls.map((c) => c.method)).toEqual(['POST'])
})

test('if only the picture fails, the passage stays saved and a line says so', async ({ page }) => {
  await api(page, { status: 400, json: { error: 'bad_image' } })
  await page.goto('/parent/content')
  await paste(page)
  await file(page).setInputFiles({ name: 'seed.png', mimeType: 'image/png', buffer: png() })
  await page.getByRole('button', { name: 'Save passage' }).click()
  await expect(
    page.getByText(
      'Saved "The Little Seed", but the picture couldn\'t be added. Edit the passage to try again.',
    ),
  ).toBeVisible()
  await expect(box(page)).toHaveValue('')
  await expect(page.getByText('seed.png')).toHaveCount(0)
})

test('a file dropped on the box is taken like a chosen one', async ({ page }) => {
  await api(page)
  await page.goto('/parent/content')
  await expect(page.locator('.file-drop')).toBeVisible()
  await page.evaluate(
    (bytes) => {
      const transfer = new DataTransfer()
      transfer.items.add(new File([new Uint8Array(bytes)], 'dropped.png', { type: 'image/png' }))
      document
        .querySelector('.file-drop')!
        .dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }))
    },
    [...png()],
  )
  await expect(page.getByText('dropped.png (1 KB)')).toBeVisible()
})

test('an edited passage gets its picture too: it goes to that passage, with Save changes', async ({
  page,
}) => {
  const calls = await api(page, undefined, undefined, [
    { id: 2, title: 'The Little Seed', minutes: 2, questions: 1, timesRead: 0 },
  ])
  await page.goto('/parent/content')
  await page.getByRole('button', { name: 'Edit The Little Seed' }).click()
  await expect(page.getByText('Editing "The Little Seed"')).toBeVisible()
  await file(page).setInputFiles({ name: 'new.png', mimeType: 'image/png', buffer: png() })
  await expect(page.getByText('new.png (1 KB)')).toBeVisible()
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByText('Saved your changes to "The Little Seed".')).toBeVisible()
  expect(calls.map((c) => [c.method, c.path])).toEqual([
    ['PUT', '/api/parent/passages/2'],
    ['PUT', '/api/parent/passages/2/image'],
  ])
})

test('while the picture is on its way, Save, the box and Remove wait, so the passage is added once', async ({
  page,
}) => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => (release = resolve))
  const calls = await api(page, undefined, gate)
  await page.goto('/parent/content')
  await paste(page)
  await file(page).setInputFiles({ name: 'seed.png', mimeType: 'image/png', buffer: png() })
  await page.getByRole('button', { name: 'Save passage' }).click()
  await expect(page.getByRole('button', { name: 'Saving…' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Remove picture' })).toBeDisabled()
  await expect(file(page)).toBeDisabled()
  release()
  await expect(page.getByText('Saved "The Little Seed".')).toBeVisible()
  expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1)
})
