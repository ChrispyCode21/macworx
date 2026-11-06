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

// The type scale (docs/DESIGN.md §4 and docs/DESIGN-PRACTICE.md §4): every px size the two contracts use.
const TEXT = [
  10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25, 26, 28, 29, 30, 40, 42, 44, 48, 52, 58,
]
// The child app's base styles size some text in rem, which scales with the 24px root and is not on the scale.
// Each is listed here (selector and value), so a new one fails until it is added.
const REM_SIZES = [
  'h1 2.4rem',
  '.button-primary 1.6rem',
  '.button-check 1.2rem',
  '.stacked 2.8rem',
  '.response-lead 1.8rem',
  '.response-equation 1.6rem',
  '.result-macaronis 1.6rem',
  '.home-numbers li 1.4rem',
  '.code-boxes 2.8rem',
]

// The first :root block: where the tokens are defined.
const root = css.slice(css.indexOf(':root {'), css.indexOf('\n}\n', css.indexOf(':root {')))

// The literal spacing values from the scale in a stretch of CSS: padding, margin and gap, with the `calc()` and `env()`
// (safe areas) parts left alone, and negative values (not on the scale).
function literalSpacing(text: string): string[] {
  const found: string[] = []
  for (const m of text.matchAll(
    /^\s*((?:padding|margin)(?:-[a-z-]+)?|gap|row-gap|column-gap):\s*([^;]+);/gm,
  )) {
    const own = m[2].replace(/calc\((?:[^()]|\([^()]*\))*\)|env\([^()]*\)/g, '')
    for (const n of own.matchAll(/(?<![\w.#-])(\d+)px/g))
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

  it('uses a spacing token, not a literal value, in every padding, margin and gap', () => {
    expect(portal.length, 'the portal block markers are missing').toBeGreaterThan(1000)
    expect(literalSpacing(css), 'src/index.css uses a literal spacing from the scale').toEqual([])
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

  it('has a text token in :root for each size on the scale, with exactly that value, and no other', () => {
    for (const px of TEXT) expect(root).toContain(`--text-${px}: ${px}px;`)
    const defined = [...css.matchAll(/^\s*(--text-[a-z0-9-]+):\s*([^;]+);/gm)].map((m) => m[1])
    expect(defined.sort()).toEqual(TEXT.map((px) => `--text-${px}`).sort())
  })

  it('uses a text token, not a literal size, for every font-size', () => {
    const literal: string[] = []
    const rem: string[] = []
    let selector = ''
    for (const line of css.split('\n')) {
      if (line.trimEnd().endsWith('{')) selector = line.trim().replace(/\s*\{$/, '')
      const m = line.match(/^\s*font-size:\s*(\d*\.?\d+)(px|rem|em)\s*;/)
      if (!m) continue
      if (m[2] === 'px') {
        // The 24px on :root is the rem base.
        if (selector !== ':root') literal.push(`${selector}: ${m[1]}px (use var(--text-${m[1]}))`)
      } else rem.push(`${selector} ${m[1]}${m[2]}`)
    }
    expect(literal, 'src/index.css uses a literal font size').toEqual([])
    expect(rem, 'the rem sizes in the base styles changed; update REM_SIZES').toEqual(REM_SIZES)
  })
})
