import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { COPY } from '../../copy'
import { parsePassageJson } from '../../engine'
import { ContentScreen } from './ContentScreen'
import type { PassageForm } from './usePassageForm'
import type { WordsForm } from './useWordsForm'

const noop = () => {}

/** The Portal's form state for a pasted text, worked out the way the hook does. */
const form = (draft: string, over: Partial<PassageForm> = {}): PassageForm => ({
  draft,
  setDraft: noop,
  check: draft.trim() === '' ? null : parsePassageJson(draft),
  saving: false,
  opening: false,
  note: null,
  manual: null,
  copy: async () => {},
  save: async () => {},
  picture: null,
  pictureNote: null,
  choosing: false,
  choosePicture: async () => {},
  removePicture: noop,
  editing: null,
  version: 0,
  canEdit: true,
  report: noop,
  edit: async () => {},
  cancelEdit: noop,
  removed: noop,
  ...over,
})
const wordsForm = (over: Partial<WordsForm> = {}): WordsForm => ({
  draft: '',
  setDraft: noop,
  count: 0,
  problems: [],
  saving: false,
  note: null,
  save: async () => {},
  advice: [],
  addAlternate: () => {},
  removeAlternate: () => {},
  ...over,
})
const render = (draft: string, over: Partial<PassageForm> = {}, words: Partial<WordsForm> = {}) =>
  renderToStaticMarkup(<ContentScreen form={form(draft, over)} words={wordsForm(words)} />)
const escaped = (text: string) => text.replace(/&/g, '&amp;').replace(/'/g, '&#x27;').replace(/"/g, '&quot;')

const valid = JSON.stringify({
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
})

describe('ContentScreen', () => {
  it('shows the Reading card, the Copy button, the JSON box and the privacy note, and nothing to fix when empty', () => {
    const html = render('')
    for (const text of [
      COPY.contentReadingHeading,
      COPY.contentReadingSub,
      COPY.contentHelperTitle,
      COPY.contentCopy,
      COPY.contentJsonLabel,
      COPY.contentJsonHint,
      COPY.contentReview,
      COPY.contentSaveNote,
      COPY.contentSave,
    ])
      expect(html).toContain(escaped(text))
    expect(html).toContain('Only you can manage this content.')
    expect(html).not.toContain('safeguard')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Save passage/)
    expect(html).not.toContain('aria-invalid')
  })

  it('L18: a valid passage shows the status line and a preview with the right choice marked, and Save is enabled', () => {
    const html = render(valid)
    expect(html).toContain('Valid JSON · 1 passage · 1 question')
    expect(html).toContain('The Little Seed')
    expect(html).toContain('2 minutes to read · 2 paragraphs')
    expect(html).toContain('What does Mia plant?')
    expect(html).toMatch(/content-right[^>]*>A seed<span> · Right answer/)
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>Save passage/)
    expect(html).not.toContain('aria-invalid')
  })

  it('L19: a passage that fails the checks lists what to fix in plain words, shows no preview, and Save is disabled', () => {
    const bad = valid.replace('"correct_answer":"A seed"', '"correct_answer":"A bird"')
    const html = render(bad)
    expect(html).toContain('A few things to fix before saving:')
    expect(html).toContain('Question 1&#x27;s &quot;correct_answer&quot; isn&#x27;t one of its options.')
    expect(html).not.toContain('content-preview')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Save passage/)
    expect(html).toContain('aria-invalid="true"')
  })

  it('the checks sit in a polite live region, and the problem list is not inside a paragraph', () => {
    const html = render('{ "title": ')
    expect(html).toContain('isn&#x27;t valid JSON')
    expect(html).toContain('aria-live="polite"')
    expect(html).not.toMatch(/<p[^>]*>(?:(?!<\/p>)[\s\S])*<ul/)
  })

  it('shows a note after a save, a Saving… button while one is sent, and the prompt to copy by hand', () => {
    expect(render(valid, { note: { tone: 'info', text: COPY.contentSaved('The Little Seed') } })).toContain(
      'Saved &quot;The Little Seed&quot;.',
    )
    const saving = render(valid, { saving: true })
    expect(saving).toMatch(/<button[^>]*disabled=""[^>]*>Saving…/)
    const manual = render('', {
      manual: 'the prompt',
      note: { tone: 'warn', text: COPY.contentCopyUnavailable },
    })
    expect(manual).toMatch(/<textarea[^>]*readOnly[^>]*>the prompt<\/textarea>/)
    expect(manual).toContain('copy it by hand')
  })

  it('shows the saved passages, loading until the list arrives', () => {
    const html = render('')
    expect(html).toContain(COPY.passagesHeading)
    expect(html).toContain(COPY.parentLoading)
  })

  it('while a saved passage is open it says so, offers Cancel, and Save becomes Save changes', () => {
    const html = render(valid, { editing: { id: 3, title: 'The Little Seed' } })
    expect(html).toContain(escaped(COPY.contentEditing('The Little Seed')))
    expect(html).toContain(COPY.contentCancelEdit)
    expect(html).toContain(COPY.contentSaveChanges)
    expect(html).not.toContain(`>${COPY.contentSave}<`)
    const plain = render(valid)
    expect(plain).toContain(`>${COPY.contentSave}<`)
    expect(plain).not.toContain(COPY.contentSaveChanges)
  })

  it('has the picture box under the JSON, and names a chosen picture with a Remove button', () => {
    const empty = render('')
    expect(empty).toContain(COPY.contentPictureLabel)
    expect(empty).toContain(COPY.contentPicturePrompt)
    expect(empty).toContain('type="file"')
    expect(empty).not.toContain(COPY.contentPictureRemove)

    const file = new File([new Uint8Array(2048)], 'seed.png', { type: 'image/png' })
    const chosen = render(valid, { picture: file })
    expect(chosen).toContain('seed.png (2 KB)')
    expect(chosen).toContain(COPY.contentPictureRemove)
  })

  it('says in plain words why a picture was not taken', () => {
    expect(render('', { pictureNote: COPY.contentPictureBig })).toContain(COPY.contentPictureBig)
  })
})
