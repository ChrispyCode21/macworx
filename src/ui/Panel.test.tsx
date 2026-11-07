import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Panel } from './Panel'

describe('Panel', () => {
  it('is a section with the panel class, and keeps the caller class and attributes', () => {
    expect(renderToStaticMarkup(<Panel>x</Panel>)).toBe('<section class="parent-section">x</section>')
    const html = renderToStaticMarkup(
      <Panel className="shop-editor" aria-label="Edit" id="p">
        x
      </Panel>,
    )
    expect(html).toBe('<section class="parent-section shop-editor" aria-label="Edit" id="p">x</section>')
  })

  it('can be a div or a list item', () => {
    expect(renderToStaticMarkup(<Panel as="li">x</Panel>)).toBe('<li class="parent-section">x</li>')
    expect(
      renderToStaticMarkup(
        <Panel as="div" className="overview-stat">
          x
        </Panel>,
      ),
    ).toBe('<div class="parent-section overview-stat">x</div>')
  })
})
