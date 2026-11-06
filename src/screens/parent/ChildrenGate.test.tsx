import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ChildrenGate } from './ChildrenGate'

const render = (signedOut: boolean, retrying = false) =>
  renderToStaticMarkup(<ChildrenGate signedOut={signedOut} retrying={retrying} onRetry={() => {}} />)

describe('ChildrenGate', () => {
  it("says the children can't be shown and offers Try again, with no form", () => {
    const html = render(false)
    expect(html).toContain('We can&#x27;t show your children right now.')
    expect(html).toContain('Try again')
    expect(html).not.toContain('<input')
    expect(html).not.toContain('Children')
    // The alert is the message alone, not the button.
    expect(html).toContain('</p><button')
  })
  it('says the sign-in has run out, without Try again', () => {
    const html = render(true)
    expect(html).toContain('Your sign-in has run out.')
    expect(html).not.toContain('Try again')
  })
  it('says Loading while it reads again, and keeps its button', () => {
    const html = render(false, true)
    expect(html).toContain('Loading…')
    expect(html).toContain('Try again')
  })
})
