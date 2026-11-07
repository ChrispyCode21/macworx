import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HeroLine, HeroNumber, HeroPanel, HeroRow, HeroUnit } from './HeroPanel'

describe('HeroPanel', () => {
  it('labels the section by its heading, with the variant class on the container', () => {
    const html = renderToStaticMarkup(
      <HeroPanel variant="points" label="Available balance">
        <HeroRow>
          <HeroNumber>41</HeroNumber>
          <HeroUnit>Macaronis</HeroUnit>
        </HeroRow>
        <HeroLine>+12 earned today</HeroLine>
      </HeroPanel>,
    )
    expect(html).toContain('<section class="parent-hero points-hero" aria-labelledby="points-hero-heading">')
    expect(html).toContain('<h2 id="points-hero-heading" class="parent-hero-label">Available balance</h2>')
    expect(html).toContain(
      '<p class="parent-hero-row"><span class="parent-hero-number">41</span><span class="parent-hero-unit">Macaronis</span></p>',
    )
    expect(html).toContain('<p class="parent-hero-line">+12 earned today</p>')
  })

  it('puts the icon in the label row, beside the heading', () => {
    const html = renderToStaticMarkup(
      <HeroPanel variant="overview" label="Today" icon={<svg data-icon />}>
        <HeroRow>x</HeroRow>
      </HeroPanel>,
    )
    expect(html).toMatch(/<div class="parent-hero-top"><h2[^>]*>Today<\/h2><svg data-icon/)
  })
})
