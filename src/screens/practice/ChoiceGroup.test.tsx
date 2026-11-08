import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ChoiceGroup } from './ChoiceGroup'

// Arrow keys and focus need a browser: e2e/spelling.spec.ts and e2e/reading.spec.ts check them.
const render = (over: Partial<Parameters<typeof ChoiceGroup>[0]> = {}) =>
  renderToStaticMarkup(
    <ChoiceGroup
      className="list"
      textClass="text"
      label="Pick one"
      choices={['one', 'two', 'three']}
      chosen={null}
      onChoose={() => {}}
      checked={false}
      right={false}
      {...over}
    />,
  )

const buttons = (html: string) => html.match(/<button[^>]*>.*?<\/button>/g) ?? []

describe('ChoiceGroup', () => {
  it('is a labelled radio group of lettered radios', () => {
    const html = render()
    expect(html).toContain('<div class="list" role="radiogroup" aria-label="Pick one">')
    const all = buttons(html)
    expect(all).toHaveLength(3)
    all.forEach((b, i) => {
      expect(b).toContain('role="radio"')
      expect(b).toContain(
        `<span class="choice-marker">${'ABC'[i]}</span><span class="text">${['one', 'two', 'three'][i]}</span>`,
      )
    })
  })

  it('has one tab stop: the first choice until one is chosen, then the chosen one', () => {
    expect(buttons(render()).map((b) => /tabindex="(-?\d)"/.exec(b)?.[1])).toEqual(['0', '-1', '-1'])
    const picked = buttons(render({ chosen: 2 }))
    expect(picked.map((b) => /tabindex="(-?\d)"/.exec(b)?.[1])).toEqual(['-1', '-1', '0'])
    expect(picked.map((b) => /aria-checked="(\w+)"/.exec(b)?.[1])).toEqual(['false', 'false', 'true'])
  })

  it('after Check locks the choices and marks the chosen one right with a check, or not right without', () => {
    const right = buttons(render({ chosen: 1, checked: true, right: true }))
    expect(right.every((b) => b.includes('disabled=""'))).toBe(true)
    expect(right[1]).toContain('data-result="right"')
    expect(right[1]).toContain('<svg')
    expect(right[0]).not.toContain('data-result')
    const wrong = buttons(render({ chosen: 1, checked: true, right: false }))
    expect(wrong[1]).toContain('data-result="not-right"')
    expect(wrong[1]).not.toContain('<svg')
  })
})
