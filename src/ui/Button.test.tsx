import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Button, type ButtonVariant } from './Button'

const PRACTICE: ButtonVariant[] = ['action', 'action-secondary', 'crumb', 'play', 'support', 'choice']

describe('Button practice variants', () => {
  it.each(PRACTICE)('%s renders a plain button with its class', (variant) => {
    const html = renderToStaticMarkup(
      <Button variant={variant} disabled aria-label="Go" aria-checked={false}>
        x
      </Button>,
    )
    expect(html).toContain(`class="button button-${variant}"`)
    expect(html).toContain('type="button"')
    expect(html).toContain('disabled=""')
    expect(html).toContain('aria-label="Go"')
    expect(html).toContain('aria-checked="false"')
  })
})
