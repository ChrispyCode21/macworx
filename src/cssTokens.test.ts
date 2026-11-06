import { describe, expect, it } from 'vitest'

// The app's TypeScript has no Node types and Vitest hands CSS imports back empty, so the file is read by Node.
const nodeFs = 'node:fs'
const { readFileSync } = (await import(/* @vite-ignore */ nodeFs)) as {
  readFileSync: (path: URL, encoding: 'utf8') => string
}
const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8')

// The size scales (docs/DESIGN.md §3): the exact values the design frames give, in px. The spacing scale also
// has 40 and 48, which the practice layout uses (docs/DESIGN-PRACTICE.md §3). Tokens are named for these values.
const RADIUS: Record<string, number> = {
  segment: 9,
  completion: 11,
  control: 12,
  reward: 14,
  panel: 20,
  pill: 100,
}
const SPACING = [2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 15, 16, 18, 20, 22, 24, 28, 32, 40, 48]

// The first :root block: where the tokens are defined.
const root = css.slice(css.indexOf(':root {'), css.indexOf('\n}\n', css.indexOf(':root {')))

// The literal spacing values from the scale in a stretch of CSS: padding, margin and gap, with `calc()` and `env()`
// (safe areas) left alone, and negative values (not on the scale).
function literalSpacing(text: string): string[] {
  const found: string[] = []
  for (const m of text.matchAll(
    /^\s*((?:padding|margin)(?:-[a-z-]+)?|gap|row-gap|column-gap):\s*([^;]+);/gm,
  )) {
    if (/calc\(|env\(/.test(m[2])) continue
    for (const n of m[2].matchAll(/(?<![\w.#-])(\d+)px/g))
      if (SPACING.includes(Number(n[1]))) found.push(`${m[1]}: ${n[1]}px (use var(--space-${n[1]}))`)
  }
  return found
}

// The parent portal's styles: between its marker comments.
const portal = css.slice(css.indexOf('/* parent portal: start */'), css.indexOf('/* parent portal: end */'))

describe('size tokens', () => {
  it('has a radius token in :root for each value on the scale, with exactly that value', () => {
    for (const [name, px] of Object.entries(RADIUS)) expect(root).toContain(`--radius-${name}: ${px}px;`)
  })

  it('has a spacing token in :root for each value on the scale, with exactly that value', () => {
    for (const px of SPACING) expect(root).toContain(`--space-${px}: ${px}px;`)
  })

  it('defines no other radius or spacing token, and every one is in px', () => {
    const defined = [...css.matchAll(/^\s*(--(?:radius|space)-[a-z0-9-]+):\s*([^;]+);/gm)]
    const allowed = [
      ...Object.keys(RADIUS).map((name) => `--radius-${name}`),
      ...SPACING.map((px) => `--space-${px}`),
    ]
    for (const [, name, value] of defined) {
      expect(allowed, `${name} is not on the scale in docs/DESIGN.md §3`).toContain(name)
      expect(value, `${name} must be a px value`).toMatch(/^\d+px$/)
    }
    expect(defined).toHaveLength(allowed.length)
  })

  it('keeps the older tokens as aliases of the scale', () => {
    for (const line of [
      '--space: var(--space-24);',
      '--gap: var(--space-16);',
      '--gap-small: var(--space-8);',
      '--radius: var(--radius-panel);',
    ])
      expect(root).toContain(line)
  })

  it("uses a spacing token, not a literal value, in the portal's padding, margin and gap", () => {
    expect(portal.length).toBeGreaterThan(1000)
    expect(literalSpacing(portal), 'the parent portal block uses a literal spacing from the scale').toEqual(
      [],
    )
  })

  it('uses a radius token, not a literal value, wherever the value is on the scale', () => {
    const byValue = Object.fromEntries(Object.entries(RADIUS).map(([name, px]) => [px, name]))
    // Any radius property (also the corner ones), with one value or several.
    const literal = [...css.matchAll(/^\s*border(?:-[a-z]+)*-radius:\s*([^;]+);/gm)]
      .flatMap((m) => [...m[1].matchAll(/(?<![\w.-])(\d+)px/g)].map((n) => Number(n[1])))
      .filter((px) => px in byValue)
    expect(
      literal.map((px) => `${px}px (use var(--radius-${byValue[px]}))`),
      'src/index.css uses a literal radius from the scale',
    ).toEqual([])
  })
})
