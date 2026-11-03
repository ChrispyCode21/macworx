import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { NumberPad } from './NumberPad'

const noop = () => {}

describe('NumberPad', () => {
  it('keeps the Check key and the delete glyph by default (the Pair screen)', () => {
    const html = renderToStaticMarkup(<NumberPad onDigit={noop} onDelete={noop} onCheck={noop} canCheck />)
    expect(html).toContain('button-check')
    expect(html).toContain('⌫')
  })

  it('the practice pad has no Check key and an icon named Delete', () => {
    const html = renderToStaticMarkup(<NumberPad practice onDigit={noop} onDelete={noop} />)
    expect(html).not.toContain('button-check')
    expect(html).not.toContain('⌫')
    expect(html).toContain('aria-label="Delete"')
    expect(html).toContain('<svg')
  })

  it('the practice pad ends with an empty cell, 0 and delete', () => {
    const html = renderToStaticMarkup(<NumberPad practice onDigit={noop} onDelete={noop} />)
    expect(html).toMatch(/9<\/button><span><\/span><button[^>]*>0<\/button><button[^>]*aria-label="Delete"/)
  })
})
