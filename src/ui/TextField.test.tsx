import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TextField } from './TextField'

describe('TextField', () => {
  it('renders the label and a plain input with no unit', () => {
    const html = renderToStaticMarkup(<TextField label="Name" />)
    expect(html).toContain('Name')
    expect(html).toContain('class="text-field-input"')
    expect(html).not.toContain('text-field-unit')
    expect(html).not.toContain('text-field-row')
  })

  it('renders the unit after the input when one is given', () => {
    const html = renderToStaticMarkup(<TextField label="Price" unit="Macaronis" />)
    expect(html).toContain('<span class="text-field-unit">Macaronis</span>')
    expect(html.indexOf('<input')).toBeLessThan(html.indexOf('text-field-unit'))
  })
})
