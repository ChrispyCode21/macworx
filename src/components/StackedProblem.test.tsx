import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { makeProblem } from '../engine'
import { StackedProblem } from './StackedProblem'

const html = (problem: ReturnType<typeof makeProblem>, boxes: number, shown = '') =>
  renderToStaticMarkup(<StackedProblem problem={problem} boxes={boxes} shown={shown} next={boxes - 1} />)

describe('StackedProblem', () => {
  it('stacks a division like a long-division bracket (SPEC §5.1 step 3)', () => {
    // 144 ÷ 12: the divisor left of a bracket round 1 4 4, and one answer box over each of the 3 digits.
    const out = html(makeProblem('division', 144, 12), 3, '12')
    expect(out.match(/class="answer-box/g)).toHaveLength(3)
    expect(out.match(/class="stacked-digit stacked-dividend/g)).toHaveLength(3)
    expect(out).toContain('stacked-dividend-first')
    expect(out).toContain('<span class="stacked-divisor">12</span>')
    // The answer boxes come first, so they sit above the dividend, and her 12 ends in the ones box.
    expect(out.indexOf('answer-box')).toBeLessThan(out.indexOf('stacked-dividend'))
    expect(out).toMatch(
      /answer-box"><\/span><span class="answer-box">1<\/span><span class="answer-box answer-box-next">2<\/span>/,
    )
    expect(out).not.toContain('stacked-rule')
  })

  it('keeps the paper layout for the other operations', () => {
    const out = html(makeProblem('multiplication', 24, 6), 3)
    expect(out).toContain('stacked-rule')
    expect(out).not.toContain('stacked-division')
  })
})
