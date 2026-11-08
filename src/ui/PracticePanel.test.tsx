import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PracticePanel } from './PracticePanel'

describe('PracticePanel', () => {
  it('is a section with the panel class, keeping the caller class and attributes', () => {
    expect(renderToStaticMarkup(<PracticePanel>x</PracticePanel>)).toBe(
      '<section class="practice-panel">x</section>',
    )
    expect(
      renderToStaticMarkup(
        <PracticePanel className="practice-done" tabIndex={0} aria-labelledby="t">
          x
        </PracticePanel>,
      ),
    ).toBe('<section class="practice-panel practice-done" tabindex="0" aria-labelledby="t">x</section>')
  })

  it('adds the variant class after the panel class', () => {
    for (const variant of ['problem', 'warm', 'soft'] as const)
      expect(renderToStaticMarkup(<PracticePanel variant={variant}>x</PracticePanel>)).toBe(
        `<section class="practice-panel practice-panel-${variant}">x</section>`,
      )
  })

  it('can be an aside or a div', () => {
    expect(
      renderToStaticMarkup(
        <PracticePanel as="aside" variant="soft" className="practice-companion">
          x
        </PracticePanel>,
      ),
    ).toBe('<aside class="practice-panel practice-panel-soft practice-companion">x</aside>')
    expect(renderToStaticMarkup(<PracticePanel as="div">x</PracticePanel>)).toBe(
      '<div class="practice-panel">x</div>',
    )
  })
})
