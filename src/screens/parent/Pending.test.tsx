import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Pending } from './Pending'

describe('Pending', () => {
  it('says Loading while the read is under way', () => {
    expect(renderToStaticMarkup(<Pending failed={false} />)).toContain('Loading…')
  })
  it('says Not available right now once a read has failed, never a dash', () => {
    const html = renderToStaticMarkup(<Pending failed />)
    expect(html).toContain('Not available right now.')
    expect(html).not.toContain('—')
  })
})
