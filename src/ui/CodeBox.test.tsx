import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CodeBox } from './CodeBox'

const noop = () => {}

describe('CodeBox', () => {
  it('renders a labelled textarea with autocorrect, capitals and spell check off', () => {
    const html = renderToStaticMarkup(
      <CodeBox label="Passage JSON" hint="Paste it." value="" onChange={noop} />,
    )
    expect(html).toContain('Passage JSON')
    expect(html).toContain('Paste it.')
    expect(html).toMatch(/<label[^>]*for="([^"]+)"[\s\S]*<textarea[^>]*id="\1"/)
    expect(html).toContain('spellCheck="false"')
    expect(html).toContain('autoCapitalize="off"')
    expect(html).toContain('autoCorrect="off"')
  })

  it('numbers every line, at least 13, and the gutter is hidden from screen readers', () => {
    const numbers = (value: string) =>
      [
        ...renderToStaticMarkup(<CodeBox label="x" value={value} onChange={noop} />).matchAll(
          /<span>(\d+)<\/span>/g,
        ),
      ].map((m) => Number(m[1]))
    expect(numbers('')).toHaveLength(13)
    expect(numbers(Array.from({ length: 20 }, () => 'a').join('\n'))).toHaveLength(20)
    expect(renderToStaticMarkup(<CodeBox label="x" value="" onChange={noop} />)).toContain(
      'aria-hidden="true"',
    )
  })
})
