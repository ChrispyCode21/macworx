import { describe, expect, it } from 'vitest'
import { makeProblem } from '../engine'
import { answerValue, boxCount, deleteDigit, entryFor, nextBox, shownDigits, typeDigit } from './answer'

const tap = (...digits: number[]) => digits.reduce((typed, d) => typeDigit(typed, d, 6), '')

describe('answer boxes (SPEC §5.1)', () => {
  it('has one more box than the numbers for addition, room for a carry', () => {
    expect(boxCount(makeProblem('addition', 100, 200))).toBe(4)
    expect(boxCount(makeProblem('addition', 99999, 99999))).toBe(6)
  })

  it('has as many boxes as the numbers for subtraction', () => {
    expect(boxCount(makeProblem('subtraction', 4512, 4512))).toBe(4)
  })

  it('has two boxes for multiplication, enough for 9 × 9', () => {
    expect(boxCount(makeProblem('multiplication', 7, 8))).toBe(2)
  })
})

describe('ones place first: addition and subtraction', () => {
  const entry = entryFor('addition')

  it('100 + 200: typing 0, 0, 3 gives 300', () => {
    const typed = tap(0, 0, 3)
    expect(shownDigits(typed, entry)).toBe('300')
    expect(answerValue(typed, entry)).toBe(300)
  })

  it('moves the next box one column left per digit', () => {
    expect(nextBox('', entry, 4)).toBe(3)
    expect(nextBox(tap(0), entry, 4)).toBe(2)
    expect(nextBox(tap(0, 0, 3, 1), entry, 4)).toBeNull()
  })

  it('reads a leading 0 as nothing: 0, 0, 3, 0 is still 300', () => {
    expect(answerValue(tap(0, 0, 3, 0), entry)).toBe(300)
  })

  it('takes a lone 0, since subtraction can give 0', () => {
    expect(answerValue(tap(0), entryFor('subtraction'))).toBe(0)
  })

  it('delete removes the digit typed last, the leftmost one', () => {
    expect(shownDigits(deleteDigit(tap(5, 8, 7)), entry)).toBe('85')
  })
})

describe('left to right: multiplication', () => {
  const entry = entryFor('multiplication')

  it('7 × 8: typing 5, 6 gives 56', () => {
    expect(answerValue(tap(5, 6), entry)).toBe(56)
  })

  it('keeps a one-digit product in the ones box', () => {
    expect(shownDigits(tap(6), entry)).toBe('6')
    expect(nextBox(tap(6), entry, 2)).toBe(1)
  })
})

describe('typing limits', () => {
  it('ignores a digit once every box is full', () => {
    expect(typeDigit('12', 3, 2)).toBe('12')
  })

  it('delete does nothing when there is nothing typed', () => {
    expect(deleteDigit('')).toBe('')
  })
})
