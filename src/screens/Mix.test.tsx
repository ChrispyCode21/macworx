import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { COPY } from '../copy'
import type { Mix as MixOf } from '../engine'
import { Mix } from './Mix'

const ONE: MixOf = [{ operation: 'division', level: 'easy' }]
const THREE: MixOf = [
  { operation: 'multiplication', level: 'medium' },
  { operation: 'division', level: 'easy' },
  { operation: 'addition', level: 'hard' },
]
const render = (props: Partial<Parameters<typeof Mix>[0]> = {}) =>
  renderToStaticMarkup(
    <Mix lastMix={null} earn={24} noSeeds={false} onStart={() => {}} onBack={() => {}} {...props} />,
  )

describe('the mix screen', () => {
  it('opens empty: the grid, a count, a disabled Start and no "Same as last time"', () => {
    const html = render()
    expect(html).toContain(COPY.mixHeading)
    expect(html).toContain('0 of 3 picked')
    expect(html).toContain('Your next little win.')
    expect(html).toContain('Pick something to start')
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(12)
    expect(html).toMatch(
      /disabled=""[^>]*class="button button-action"|class="button button-action"[^>]*disabled=""/,
    )
    expect(html).not.toContain(COPY.mixSame)
    expect(html).not.toContain(COPY.mixSwap)
    expect(html).toContain('Earn up to 24 Macaronis.')
  })

  it('lists the picks in order with their problem counts, and dims the other cells at 3', () => {
    const html = render({ initial: THREE, lastMix: THREE })
    expect(html).toContain('A little of everything.')
    expect(html).toContain('3 of 3 picked')
    expect(html).toContain(COPY.mixSwap)
    expect(html).toContain(COPY.mixSame)
    expect(html).toContain('Mixed together into one practice.')
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(3)
    expect(html.match(/aria-disabled="true"/g)).toHaveLength(9 + 1) // the other cells, and Shop
    expect(html.match(/>(\d+) problems</g)).toEqual([
      '>7 problems<',
      '>7 problems<',
      '>6 problems<',
      '>20 problems<',
    ])
  })

  it('says "One at a time." with one pick and has no mixed-together line', () => {
    const html = render({ initial: ONE })
    expect(html).toContain('One at a time.')
    expect(html).toContain('>20 problems<')
    expect(html).not.toContain('Mixed together')
  })

  it('shows the Wi-Fi line when there are no seeds', () => {
    expect(render({ noSeeds: true })).toContain('Connect to Wi-Fi to get more problems!')
    expect(render()).not.toContain('Connect to Wi-Fi')
  })
})
