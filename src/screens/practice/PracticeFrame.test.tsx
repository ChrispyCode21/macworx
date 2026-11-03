import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { HomeNumbers } from '../../sync/projection'
import { COPY } from '../../copy'
import { Home } from '../Home'
import { PracticeFrame } from './PracticeFrame'

const NUMBERS: HomeNumbers = { balance: 1204, completed: 3, streak: 7, latestGrade: null }

const render = (numbers?: HomeNumbers, note: string | undefined = 'A note') =>
  renderToStaticMarkup(
    <PracticeFrame
      numbers={numbers}
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

  it('leaves out the avatar and the Shop button', () => {
    const html = render(NUMBERS)
    expect(html).not.toContain('Shop')
    expect(html).not.toContain('avatar')
  })

  it('leaves out the note paragraph when there is none', () => {
    expect(render(NUMBERS, 'A note')).toContain('practice-note')
    const html = render(NUMBERS, '')
    expect(html).not.toContain('practice-note')
    expect(html).toContain('practice-buttons')
  })

  it('hides the chips on the same inputs as Home hides the numbers', () => {
    const home = (numbers?: HomeNumbers) =>
      renderToStaticMarkup(<Home onStart={() => {}} numbers={numbers} />)
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
      expect(frame.includes(balance), name + ': balance').toBe(page.includes(balance))
      const streak = numbers?.streak == null ? 'no streak' : COPY.streakChip(numbers.streak)
      const homeStreak = numbers?.streak == null ? 'no streak' : COPY.streakDays(numbers.streak)
      expect(frame.includes(streak), name + ': streak').toBe(page.includes(homeStreak))
    }
  })
})
