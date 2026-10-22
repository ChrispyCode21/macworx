import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { REWARDS } from '../engine'
import { RewardIcon } from './RewardIcon'

describe('RewardIcon', () => {
  it.each(REWARDS.map((r) => r.id))('draws a decorative svg for %s', (id) => {
    const html = renderToStaticMarkup(<RewardIcon id={id} />)
    expect(html).toContain('<svg')
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('<path')
    expect(html).toContain(`data-reward="${id}"`)
  })

  it('draws a different picture for every reward', () => {
    const markups = REWARDS.map((r) => renderToStaticMarkup(<RewardIcon id={r.id} />))
    expect(new Set(markups).size).toBe(REWARDS.length)
  })
})
