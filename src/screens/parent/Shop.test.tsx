import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Shop } from './Shop'

const render = (name: string | null, balance: number | null, problem = false) =>
  renderToStaticMarkup(<Shop name={name} balance={balance} problem={problem} />)

describe('Shop', () => {
  it('lists the four rewards with their formatted prices', () => {
    const html = render('Ada', 0)
    for (const name of ['Ice Cream', 'Pet Store', 'Camping', 'Puppy']) expect(html).toContain(name)
    for (const price of ['30 Macaronis', '75 Macaronis', '300 Macaronis', '10,000 Macaronis'])
      expect(html).toContain(price)
    expect(html).toContain('4 active')
  })

  it('says within reach or how many Macaronis more, with a thousands separator', () => {
    const html = render('Ada', 41)
    expect(html).toContain('30 Macaronis · Within reach')
    expect(html).toContain('75 Macaronis · 34 more to go')
    expect(html).toContain('10,000 Macaronis · 9,959 more to go')
    expect(html).toContain('Ada has 41 Macaronis')
  })

  it.each([
    [0, '0 rewards within reach.'],
    [30, '1 reward within reach.'],
    [10000, '4 rewards within reach.'],
  ])('at balance %i the summary reads "%s"', (balance, line) => {
    const html = render('Ada', balance)
    expect(html).toContain(line)
    expect(html).not.toMatch(/ of /)
  })

  it('renders every button and field disabled', () => {
    const html = render('Ada', 41)
    const tags = html.match(/<(button|input)\b[^>]*>/g) ?? []
    expect(tags.length).toBeGreaterThanOrEqual(10)
    for (const tag of tags) expect(tag).toContain('disabled')
  })

  it('shows the editor for the first reward, with its unit and the note', () => {
    const html = render('Ada', 41)
    expect(html).toContain('value="Ice Cream"')
    expect(html).toContain('value="30"')
    expect(html).toContain('<span class="text-field-unit">Macaronis</span>')
    expect(html).toContain('Read-only')
    expect(html).toContain('Editing rewards is coming soon.')
  })

  it('shows the empty state for Last redeemed', () => {
    const html = render('Ada', 41)
    expect(html).toContain('aria-label="Last redeemed"')
    expect(html).toContain('No rewards redeemed yet.')
  })

  it('has no summary card and a plain heading with no child', () => {
    const html = render(null, null)
    expect(html).not.toContain('shop-summary')
    expect(html).toContain('>Rewards shop<')
  })

  it('shows no balance sentence and only prices while the balance is unknown', () => {
    const html = render('Ada', null)
    expect(html).not.toMatch(/has .* Macaronis/)
    expect(html).not.toContain('within reach')
    expect(html).not.toContain('more to go')
    expect(html).toContain('Loading…')
  })

  it('shows a dash instead of Loading when a call has failed', () => {
    const html = render('Ada', null, true)
    expect(html).not.toContain('Loading…')
    expect(html).toContain('>—<')
  })
})
