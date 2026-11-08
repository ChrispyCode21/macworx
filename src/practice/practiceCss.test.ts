import { describe, expect, it } from 'vitest'

// The app's TypeScript has no Node types and Vitest hands CSS imports back empty, so the file is read by Node.
const nodeFs = 'node:fs'
const { readFileSync } = (await import(/* @vite-ignore */ nodeFs)) as {
  readFileSync: (path: URL, encoding: 'utf8') => string
}
const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')

// docs/DESIGN-PRACTICE.md §5: the practice colour tokens.
const TOKENS: Record<string, string> = {
  '--l-bg': 'var(--paper)',
  '--l-surface': '#ffffff',
  '--l-inset': '#fffbee',
  '--l-line': '#efdba5',
  '--l-primary': 'var(--accent)',
  '--l-primary-ink': 'var(--ink)',
  '--l-link': 'var(--answer-ink)',
  '--l-chip': 'var(--soft)',
  '--l-warm': '#f6dc9e',
  '--l-avatar': '#f2c46b',
  '--l-text': 'var(--ink)',
  '--l-muted': '#6b5420',
}

const START = '/* practice: start */'
const END = '/* practice: end */'
const practice = css.slice(css.indexOf(START), css.indexOf(END))

describe('the practice CSS (docs/DESIGN-PRACTICE.md §3, §5)', () => {
  it('is delimited by its markers', () => {
    expect(css.indexOf(START)).toBeGreaterThanOrEqual(0)
    expect(css.indexOf(END)).toBeGreaterThan(css.indexOf(START))
  })

  it('defines every colour token with its exact value', () => {
    for (const [name, value] of Object.entries(TOKENS)) expect(practice).toContain(`${name}: ${value};`)
  })

  it('uses px only: no rem, no em', () => {
    expect(practice).not.toMatch(/\d(rem|em)\b/)
  })

  it('keeps full opacity on a disabled choice, and styles right and not right after Check', () => {
    expect(practice).toMatch(/\.button-choice:disabled\s*\{\s*opacity:\s*1;/)
    expect(practice).toContain(".button-choice[data-result='right']")
    expect(practice).toContain(".button-choice[data-result='not-right']")
  })

  it('does not reset the font size or cap the pad width', () => {
    expect(practice).not.toMatch(/\.practice\s*\{[^}]*font-size/)
    expect(practice).not.toContain('max-width: 360px')
  })

  it('lays out the Math panels and the practice stacked sizes (§7.1, §8)', () => {
    const rule = (selector: string) => {
      const match = practice.match(
        new RegExp(`(?:^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`),
      )
      expect(match, selector).not.toBeNull()
      return match?.[1] ?? ''
    }
    expect(rule('.practice .stacked')).toMatch(/font-size:\s*var\(--text-52\);/)
    expect(rule('.practice .stacked')).toMatch(/font-weight:\s*500;/)
    expect(rule('.practice .stacked-rule')).toContain('border-top: 2px solid var(--l-text);')
    expect(rule('.practice-panel')).toContain('padding: var(--space-32);')
    expect(rule('.practice-panel-warm')).toContain('background: var(--l-warm);')
    expect(rule('.practice-panel-warm')).toContain('padding: var(--space-24);')
    expect(rule('.practice-panel-warm')).toContain('min-height: 406px;')
    // Link text on the warm panel is 4.42:1, so its heading is plain text.
    expect(rule('.practice-panel-warm')).not.toContain('--l-link')
    expect(rule('.practice-pad-heading')).not.toContain('--l-link')
    expect(rule('.practice-eyebrow')).toContain('color: var(--l-link);')
  })

  it('uses font weights 400, 500 and 600 only', () => {
    const weights = [...practice.matchAll(/font-weight:\s*(\d+)/g)].map((m) => m[1])
    expect(weights.length).toBeGreaterThan(0)
    for (const weight of weights) expect(['400', '500', '600']).toContain(weight)
  })

  // The first top-level rule (its selector starts in column 0, so none nested in a media query) whose selector list
  // includes `selector`; with a trailing "!", the first rule that is for that selector alone (a later override of
  // a grouped rule).
  const declarations = (selector: string): string => {
    const alone = selector.endsWith('!')
    const name = alone ? selector.slice(0, -1) : selector
    for (const m of practice.matchAll(/(?:^|\n)([^\s{}@/][^{}]*)\{([^}]*)\}/g)) {
      const list = m[1].split(',').map((x) => x.trim())
      if (alone ? list.length === 1 && list[0] === name : list.includes(name)) return m[2]
    }
    throw new Error(`no rule for ${selector}`)
  }
  // The declaration as a whole property: `height: 48px;` must not be satisfied by `min-height: 48px;`.
  const has = (body: string, declaration: string) =>
    new RegExp(`(?<![-\\w])${declaration.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(body)

  // The sizes DESIGN-PRACTICE.md gives each component (a section per row). Pinned here so a change to one is
  // a decision, not an accident.
  const SIZES: [selector: string, declaration: string, where: string][] = [
    ['.practice-chip', 'height: 48px;', '§6.1 status chip'],
    ['.practice-avatar', 'width: 44px;', '§6.1 avatar circle'],
    ['.practice-avatar', 'height: 44px;', '§6.1 avatar circle'],
    ['.practice-heading', 'min-height: 90px;', '§6.2 heading block'],
    ['.practice-context', 'height: 24px;', '§6.2 context row'],
    ['.practice-task', 'min-height: 54px;', '§6.2 task row'],
    ['.practice-progress', 'width: 182px;', '§6.2 progress bar'],
    ['.practice-progress-track', 'height: 6px;', '§6.2 progress track'],
    ['.practice-progress-fill', 'height: 6px;', '§6.2 progress fill'],
    ['.practice-activity', 'min-height: 478px;', '§3 activity row'],
    ['.practice-actions', 'height: 64px;', '§6.3 buttons row'],
    ['.button-action', 'height: 56px;', '§7.4 action'],
    ['.button-action', 'min-width: 220px;', '§7.4 action'],
    ['.button-action-secondary!', 'min-width: 170px;', '§7.4 action-secondary'],
    ['.button-crumb', 'min-height: 44px;', '§7.4 crumb hit area'],
    ['.button-support', 'height: 44px;', '§7.4 support hit area'],
    ['.practice .button-key', 'height: 72px;', '§7.4 and §8 key'],
    ['.button-play', 'width: 112px;', '§7.4 play'],
    ['.button-play', 'height: 112px;', '§7.4 play'],
    ['.button-choice', 'min-height: 78px;', '§7.3 choice'],
    ['.choice-marker', 'width: 32px;', '§7.3 choice marker'],
    ['.choice-marker', 'height: 32px;', '§7.3 choice marker'],
    ['.practice-listen-text', 'width: 360px;', '§10 listen text'],
    ['.practice-choices-head', 'height: 30px;', '§10 choices heading'],
    ['.practice-question', 'min-height: 64px;', '§12 question'],
  ]

  it.each(SIZES)('%s has %s (%s)', (selector, declaration) => {
    expect(has(declarations(selector), declaration), `${selector} lacks ${declaration}`).toBe(true)
  })

  it('gives every practice button that carries text its own font weight, not the base 700', () => {
    for (const selector of [
      '.button-action',
      '.button-action-secondary',
      '.button-crumb',
      '.button-support',
      '.button-choice',
      '.practice .button-key',
    ])
      expect(declarations(selector), selector).toMatch(/font-weight:\s*(400|500|600);/)
  })

  it('draws the panel look (border, radius, flex column) once, in .practice-panel (docs/DESIGN-PRACTICE.md §7.1)', () => {
    expect(declarations('.practice-panel')).toMatch(/border: 1px solid var\(--l-line\);/)
    expect(declarations('.practice-panel')).toMatch(/border-radius: var\(--radius-panel\);/)
    expect(declarations('.practice-panel')).toMatch(/flex-direction: column;/)
    // The soft panel comes after the base, so its padding 0, no border and chip fill win.
    expect(practice.indexOf('\n.practice-panel-soft {')).toBeGreaterThan(
      practice.indexOf('\n.practice-panel {'),
    )
    expect(declarations('.practice-panel-soft')).toContain('padding: 0;')
    expect(declarations('.practice-panel-soft')).toContain('border: none;')
    // The variants only change what differs.
    expect(declarations('.practice-panel-soft'), 'the soft panel repeats the panel look').not.toMatch(
      /display|flex-direction|border-radius|min-width/,
    )
  })

  it('has one inline response style for Spelling and Reading, not one per subject', () => {
    expect(declarations('.practice .practice-inline-response')).toContain('flex: none;')
    expect(practice).not.toMatch(/practice-(?:spelling|reading)-response/)
  })
})
