import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CheckIcon } from '../parent/icons'
import { Safeguard } from './Safeguard'

describe('Safeguard', () => {
  it('is a paragraph with its tone class and the text in a span', () => {
    const html = renderToStaticMarkup(<Safeguard tone="info">Saved</Safeguard>)
    expect(html).toMatch(/^<p class="safeguard safeguard-info">/)
    expect(html).toContain('<span>Saved</span>')
    expect(html).not.toContain('role=')
  })

  it('passes the role through', () => {
    expect(
      renderToStaticMarkup(
        <Safeguard tone="warn" role="alert">
          x
        </Safeguard>,
      ),
    ).toContain('role="alert"')
    expect(
      renderToStaticMarkup(
        <Safeguard tone="info" role="status">
          x
        </Safeguard>,
      ),
    ).toContain('role="status"')
  })

  it('draws a different default icon for each tone, and the one a caller names', () => {
    const icon = (tone: 'info' | 'warn') =>
      renderToStaticMarkup(<Safeguard tone={tone}>x</Safeguard>).match(/<svg.*<\/svg>/)![0]
    expect(icon('info')).not.toBe(icon('warn'))
    expect(icon('info')).toContain('width="17"')
    const named = renderToStaticMarkup(
      <Safeguard tone="info" icon={<CheckIcon size={17} />}>
        x
      </Safeguard>,
    ).match(/<svg.*<\/svg>/)![0]
    expect(named).toBe(renderToStaticMarkup(<CheckIcon size={17} />))
  })
})
