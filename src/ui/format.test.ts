import { describe, expect, it } from 'vitest'
import { makeProblem } from '../engine'
import { formatEquation, formatNumber, operatorSymbol } from './format'

describe('display formatting', () => {
  it('uses thousands separators', () => {
    expect(formatNumber(74885)).toBe('74,885')
    expect(formatNumber(0)).toBe('0')
  })

  it('uses the math symbols, not keyboard stand-ins', () => {
    expect(operatorSymbol('subtraction')).toBe('−')
    expect(operatorSymbol('multiplication')).toBe('×')
    expect(operatorSymbol('addition')).toBe('+')
  })

  it('writes a worked equation', () => {
    expect(formatEquation(makeProblem('subtraction', 74885, 27353))).toBe('74,885 − 27,353 = 47,532')
  })
})
