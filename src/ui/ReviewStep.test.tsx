import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { ReviewStep } from './ReviewStep'

// Focus following the step needs a browser: e2e/parent.spec.ts checks it.
function html(reviewing: boolean, extra: Partial<Parameters<typeof ReviewStep>[0]> = {}) {
  return renderToStaticMarkup(
    <ReviewStep
      reviewing={reviewing}
      review={{ label: 'Review', onClick: vi.fn() }}
      confirm={{ onConfirm: vi.fn(), onBack: vi.fn(), saving: false }}
      {...extra}
    >
      <p>Change it</p>
    </ReviewStep>,
  )
}

describe('ReviewStep', () => {
  it('shows only the Review button until reviewing', () => {
    const out = html(false)
    expect(out).not.toContain('parent-review')
    expect(out).not.toContain('Change it')
    expect(out).toMatch(/<button[^>]*>Review<svg/)
  })

  it('in review shows the heading, the restated change, then Confirm and Back', () => {
    const out = html(true, { heading: 'Check it' })
    expect(out).toMatch(/class="parent-review"><h3>Check it<\/h3><p>Change it<\/p>/)
    expect(out).toMatch(/>Confirm<\/button>.*>Back<\/button>/)
    expect(out).not.toContain('>Review<')
  })

  it('disables Review when told to, and Confirm and Back while saving', () => {
    expect(html(false, { review: { label: 'Review', onClick: vi.fn(), disabled: true } })).toContain(
      'disabled=""',
    )
    const saving = html(true, { confirm: { onConfirm: vi.fn(), onBack: vi.fn(), saving: true } })
    expect(saving.match(/disabled=""/g)).toHaveLength(2)
  })
})
