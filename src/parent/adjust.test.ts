import { describe, expect, it } from 'vitest'
import { balanceAfter, checkAdjust, parseAmount } from './adjust'

describe('parseAmount', () => {
  it.each([
    ['5', 5],
    [' 12 ', 12],
    ['007', 7],
    ['100000', 100_000],
  ])('accepts %j', (text, expected) => {
    expect(parseAmount(text)).toBe(expected)
  })

  it.each(['0', '100001', '2.5', '-3', '', 'abc', '1e3'])('refuses %j', (text) => {
    expect(parseAmount(text)).toBeNull()
  })
})

describe('balanceAfter', () => {
  it('adds a signed amount', () => {
    expect(balanceAfter(40, 20)).toBe(60)
    expect(balanceAfter(40, -15)).toBe(25)
  })
})

describe('checkAdjust', () => {
  const base = { amountText: '20', note: 'Homework grades', removing: false, balance: 40 }

  it('adds 20 to 40', () => {
    expect(checkAdjust(base)).toEqual({ ok: true, amount: 20, note: 'Homework grades', after: 60 })
  })

  it('checks the amount first', () => {
    expect(checkAdjust({ ...base, amountText: '0', note: '' })).toEqual({ ok: false, problem: 'bad_amount' })
  })

  it('refuses an empty, blank or too long note, and accepts 200 characters trimmed', () => {
    for (const note of ['', '   ', 'x'.repeat(201)])
      expect(checkAdjust({ ...base, note })).toEqual({ ok: false, problem: 'bad_note' })
    const ok = checkAdjust({ ...base, note: ` ${'x'.repeat(200)} ` })
    expect(ok).toEqual({ ok: true, amount: 20, note: 'x'.repeat(200), after: 60 })
  })

  it('refuses a removal larger than the balance', () => {
    expect(checkAdjust({ ...base, amountText: '41', removing: true })).toEqual({
      ok: false,
      problem: 'below_zero',
    })
  })

  it('allows removing exactly the balance', () => {
    expect(checkAdjust({ ...base, amountText: '40', removing: true })).toEqual({
      ok: true,
      amount: -40,
      note: 'Homework grades',
      after: 0,
    })
  })
})
