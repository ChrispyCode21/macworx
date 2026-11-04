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
      const match = practice.match(new RegExp(`(?:^|\\n)${selector.replace(/[.]/g, '\\.')}\\s*\\{([^}]*)\\}`))
      expect(match, selector).not.toBeNull()
      return match?.[1] ?? ''
    }
    expect(rule('.practice .stacked')).toMatch(/font-size:\s*52px;/)
    expect(rule('.practice .stacked')).toMatch(/font-weight:\s*500;/)
    expect(rule('.practice .stacked-rule')).toContain('border-top: 2px solid var(--l-text);')
    expect(rule('.practice-panel')).toContain('padding: 32px;')
    expect(rule('.practice-panel-warm')).toContain('background: var(--l-warm);')
    expect(rule('.practice-panel-warm')).toContain('padding: 24px;')
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
})
