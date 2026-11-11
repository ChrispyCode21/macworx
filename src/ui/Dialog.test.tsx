import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Dialog } from './Dialog'

const noop = () => {}

describe('Dialog', () => {
  it('renders a native dialog named by its title, with a Close button', () => {
    const html = renderToStaticMarkup(
      <Dialog open title="Edit list" closeLabel="Close" onClose={noop}>
        <p>inside</p>
      </Dialog>,
    )
    expect(html).toMatch(/<dialog[^>]*class="dialog"[^>]*aria-labelledby="([^"]+)"/)
    expect(html).toMatch(/<h2 id="([^"]+)"[^>]*>Edit list<\/h2>/)
    expect(html).toContain('>Close</button>')
    expect(html).toContain('<p>inside</p>')
  })

  it('mounts its children only while open, so what they read is read when it opens', () => {
    const html = renderToStaticMarkup(
      <Dialog open={false} title="Edit list" closeLabel="Close" onClose={noop}>
        <p>inside</p>
      </Dialog>,
    )
    expect(html).not.toContain('inside')
  })
})
