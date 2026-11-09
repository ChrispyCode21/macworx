import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { HomeNumbers, PracticeChild } from '../../sync/projection'
import { COPY } from '../../copy'
import { formatNumber } from '../../ui/format'
import { Home } from '../Home'
import { PracticeFrame } from './PracticeFrame'

const NUMBERS: HomeNumbers = { balance: 1204, completed: 3, streak: 7, latestGrade: null }

const render = (numbers?: HomeNumbers, note: string | undefined = 'A note', child?: PracticeChild) =>
  renderToStaticMarkup(
    <PracticeFrame
      numbers={numbers}
      child={child}
      subject="Math"
      title="A title"
      progress={{ label: 'Problem 4 of 20', done: 4, total: 20 }}
      onBack={() => {}}
      backLabel="Done for now"
      note={note}
      actions={<span>actions</span>}
    >
      <span>activity</span>
    </PracticeFrame>,
  )

describe('PracticeFrame', () => {
  it('shows the brand but no chips without numbers', () => {
    const html = render()
    expect(html).toContain('macworx')
    expect(html).not.toContain('practice-chip')
  })

  it('shows the balance and the streak chip when she has both', () => {
    const html = render(NUMBERS)
    expect(html).toContain('1,204 Macaronis')
    expect(html).toContain('7 days')
  })

  it('says 1 day, and hides the streak when there is none', () => {
    expect(render({ ...NUMBERS, streak: 1 })).toContain('1 day<')
    const none = render({ ...NUMBERS, streak: null })
    expect(none).toContain('Macaronis')
    expect(none).not.toContain('day')
  })

  it('the crumb has two spaces round the slash and is named by its visible text, then Done for now', () => {
    const html = render()
    expect(html).toContain('Practice  /  Math')
    expect(html).toContain('aria-label="Practice  /  Math, Done for now"')
    expect(html).toContain('button-crumb')
  })

  it('the progress bar says where she is, at 20%', () => {
    const html = render()
    expect(html).toContain('role="progressbar"')
    expect(html).toContain('aria-valuenow="4"')
    expect(html).toContain('aria-valuemax="20"')
    expect(html).toContain('aria-label="Problem 4 of 20"')
    expect(html).toContain('width:20%')
  })

  it('leaves out the progress bar when there is no progress, and keeps the crumb', () => {
    const html = renderToStaticMarkup(
      <PracticeFrame subject="Spelling" title="A title" onBack={() => {}} backLabel="Back" actions={null}>
        {null}
      </PracticeFrame>,
    )
    expect(html).not.toContain('progressbar')
    expect(html).toContain('Practice  /  Spelling')
  })

  it('leaves out the Shop button, and the avatar and meta line without a child', () => {
    const html = render(NUMBERS)
    expect(html).not.toContain('Shop')
    expect(html).not.toContain('practice-avatar')
    expect(html).not.toContain('practice-meta')
  })

  it('shows her initials in the avatar and "{name} · {grade}" opposite the crumb', () => {
    const html = render(NUMBERS, 'A note', { name: 'Ada', grade: '4th grade', initials: 'AL' })
    expect(html).toContain('<span class="practice-avatar" aria-hidden="true">AL</span>')
    expect(html).toContain('<span class="practice-meta">\u2068Ada\u2069 · \u20684th grade\u2069</span>')
    expect(html).toContain('aria-label="Practice  /  Math, Done for now"')
  })

  it('shows just the name without a grade, and nothing without a name', () => {
    const noGrade = render(NUMBERS, 'A note', { name: 'Ada', grade: '', initials: 'AL' })
    expect(noGrade).toContain('<span class="practice-meta">\u2068Ada\u2069</span>')
    const noName = render(NUMBERS, 'A note', { name: '', grade: '4th grade', initials: 'AL' })
    expect(noName).not.toContain('practice-meta')
    expect(noName).toContain('practice-avatar')
  })

  it('isolates a right-to-left name and the grade so the digit stays with its grade', () => {
    const html = render(NUMBERS, 'A note', { name: 'דנה', grade: '4th grade', initials: 'ד' })
    expect(html).toContain('\u2068דנה\u2069 · \u20684th grade\u2069')
  })

  it('hides the avatar without initials', () => {
    const html = render(NUMBERS, 'A note', { name: 'Ada', grade: '', initials: '' })
    expect(html).not.toContain('practice-avatar')
    expect(html).toContain('practice-meta')
  })

  it('leaves out the note paragraph when there is none', () => {
    expect(render(NUMBERS, 'A note')).toContain('practice-note')
    const html = render(NUMBERS, '')
    expect(html).not.toContain('practice-note')
    expect(html).toContain('practice-buttons')
  })

  it('hides the chips on the same inputs as Home hides the numbers', () => {
    const home = (numbers?: HomeNumbers) =>
      renderToStaticMarkup(<Home onStart={() => {}} onOpen={() => {}} numbers={numbers} />)
    const cases: [string, HomeNumbers | undefined][] = [
      ['no numbers', undefined],
      ['streak null', { ...NUMBERS, streak: null }],
      ['streak 0', { ...NUMBERS, streak: 0 }],
      ['balance 0', { ...NUMBERS, balance: 0 }],
    ]
    for (const [name, numbers] of cases) {
      const frame = render(numbers)
      const page = home(numbers)
      const balance = numbers ? COPY.macaronis(numbers.balance) : 'no numbers'
      const homeBalance = numbers ? `home-balance-number">${formatNumber(numbers.balance)}<` : 'no numbers'
      expect(frame.includes(balance), name + ': balance').toBe(page.includes(homeBalance))
      const streak = numbers?.streak == null ? 'no streak' : COPY.streakChip(numbers.streak)
      const homeStreak =
        numbers?.streak == null ? 'no streak' : `>${numbers.streak} ${numbers.streak === 1 ? 'day' : 'days'}<`
      expect(frame.includes(streak), name + ': streak').toBe(page.includes(homeStreak))
    }
  })
})
