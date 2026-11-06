import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ChildrenGate } from './ChildrenGate'

const render = (signedOut: boolean) =>
  renderToStaticMarkup(<ChildrenGate signedOut={signedOut} onRetry={() => {}} />)

describe('ChildrenGate', () => {
  it("says the children can't be shown and offers Try again, with no form", () => {
    const html = render(false)
    expect(html).toContain('We can&#x27;t show your children right now.')
    expect(html).toContain('Try again')
    expect(html).not.toContain('<input')
  })
  it('says the sign-in has run out, without Try again', () => {
    const html = render(true)
    expect(html).toContain('Your sign-in has run out.')
    expect(html).not.toContain('Try again')
  })
})
