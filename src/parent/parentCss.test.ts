import { describe, expect, it } from 'vitest'

// The app's TypeScript has no Node types and Vitest hands CSS imports back empty, so the file is read by Node.
const nodeFs = 'node:fs'
const { readFileSync } = (await import(/* @vite-ignore */ nodeFs)) as {
  readFileSync: (path: URL, encoding: 'utf8') => string
}
const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8')

// docs/DESIGN.md §5.2: the parent portal's colour tokens.
const TOKENS: Record<string, string> = {
  '--p-bg': '#fff6dc',
  '--p-surface': '#ffffff',
  '--p-divider': '#efdba5',
  '--p-primary': '#f2a516',
  '--p-primary-ink': '#3b2a05',
  '--p-hero-muted': '#5a3f08',
  '--p-accent-ink': '#8a5a00',
  '--p-chip': '#fde9b8',
  '--p-warm': '#f6dc9e',
  '--p-avatar': '#f2c46b',
  '--p-warn-soft': '#f6e7cf',
  '--p-warn-ink': '#7a4a00',
  '--p-danger-soft': '#ffe0d6',
  '--p-danger-ink': '#8a3b22',
  '--p-text': '#3b2a05',
  '--p-muted': '#6b5420',
}

const START = '/* parent portal: start */'
const END = '/* parent portal: end */'
const portal = css.slice(css.indexOf(START), css.indexOf(END))

describe('the parent portal CSS (docs/DESIGN.md §2, §3, §5)', () => {
  it('is delimited by its markers', () => {
    expect(css.indexOf(START)).toBeGreaterThanOrEqual(0)
    expect(css.indexOf(END)).toBeGreaterThan(css.indexOf(START))
    expect(portal.length).toBeGreaterThan(START.length)
  })

  it('uses font weights 400 and 600 only', () => {
    const weights = [...portal.matchAll(/font-weight:\s*(\d+)/g)].map((m) => m[1])
    expect(weights.length).toBeGreaterThan(0)
    for (const weight of weights) expect(['400', '600']).toContain(weight)
  })

  it('defines every colour token with its exact value', () => {
    for (const [name, hex] of Object.entries(TOKENS)) expect(portal).toContain(`${name}: ${hex};`)
  })

  it('uses px only: no rem, no em, no old size tokens', () => {
    expect(portal).not.toMatch(/\d(rem|em)\b/)
    expect(portal).not.toContain('var(--size-')
  })

  it('has a hex colour only on a token line, and no shadows', () => {
    for (const line of portal.split('\n'))
      if (/#[0-9a-f]{3,8}\b/i.test(line)) expect(line).toMatch(/^\s*--p-[a-z-]+: #[0-9a-f]{6};$/)
    expect(portal).not.toContain('box-shadow')
  })

  it('styles the Segmented track for every screen, not one (docs/DESIGN.md §7)', () => {
    expect(portal).toMatch(/\n\.parent-choice \{[^}]*padding: var\(--space-4\);/)
    expect(portal, 'a .parent-choice rule is scoped to one screen').not.toMatch(/\.[a-z-]+ \.parent-choice/)
  })

  it('has one divider, one note style and one chip (docs/DESIGN.md §7), not a copy per screen', () => {
    for (const name of ['parent-divider', 'parent-note', 'parent-chip'])
      expect(portal.match(new RegExp(`\\n\\.${name} \\{`, 'g')), `.${name} is defined once`).toHaveLength(1)
    expect(portal).not.toMatch(
      /\.(?:shop|overview)-divider|\.(?:device-meta|pair-footnote|shop-footnote|points-footnote|streak-footnote|activity-meta)\b|\.(?:device|portal)-chip|\.shop-chip-warn/,
    )
  })

  it('centers every parent button in the base rule, not per screen (docs/DESIGN.md §7)', () => {
    expect(portal).toMatch(
      /\.parent \.button-soft \{\s*display: flex;\s*align-items: center;\s*justify-content: center;\s*gap: var\(--space-8\);/,
    )
    expect(portal, 'a screen sets its own flex on a parent button').not.toMatch(
      /\.(?:pair-panel|points|streak|shop) \.button-(?:primary|secondary|soft)[^{]*\{[^}]*display: flex/,
    )
  })
})
