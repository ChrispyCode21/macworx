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

  it('uses font weights 400, 500 and 600 only', () => {
    const weights = [...practice.matchAll(/font-weight:\s*(\d+)/g)].map((m) => m[1])
    expect(weights.length).toBeGreaterThan(0)
    for (const weight of weights) expect(['400', '500', '600']).toContain(weight)
  })
})
