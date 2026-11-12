import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FileDrop } from './FileDrop'

const render = (over: Partial<Parameters<typeof FileDrop>[0]> = {}) =>
  renderToStaticMarkup(
    <FileDrop
      label="Picture"
      prompt="Upload or drag and drop"
      hint="PNG, JPEG or WebP."
      accept="image/png,image/jpeg"
      onFile={() => {}}
      {...over}
    />,
  )

describe('FileDrop', () => {
  it('is a labelled file input with its prompt and hint, wrapped in the box', () => {
    const html = render()
    expect(html).toContain('type="file"')
    expect(html).toContain('accept="image/png,image/jpeg"')
    expect(html).toContain('Picture')
    expect(html).toContain('Upload or drag and drop')
    expect(html).toContain('PNG, JPEG or WebP.')
    expect(html).toMatch(/aria-describedby="[^"]+-hint"/)
    expect(html).toContain('class="file-drop"')
  })

  it('turns the input and the box off while disabled', () => {
    const html = render({ disabled: true })
    expect(html).toContain('disabled=""')
    expect(html).toContain('file-drop-disabled')
  })
})
