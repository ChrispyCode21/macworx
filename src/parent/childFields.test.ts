import { describe, expect, it } from 'vitest'
import { checkChildFields, cleanGrade, cleanInitials, cleanName, fillInitials } from './childFields'

describe('name', () => {
  it('accepts 1 to 40 characters and trims', () => {
    expect(cleanName('S')).toBe('S')
    expect(cleanName('a'.repeat(40))).toHaveLength(40)
    expect(cleanName('  Mary Jane ')).toBe('Mary Jane')
  })
  it('refuses 0, 41, whitespace-only, control characters and non-text', () => {
    expect(cleanName('')).toBeNull()
    expect(cleanName('a'.repeat(41))).toBeNull()
    expect(cleanName('   ')).toBeNull()
    expect(cleanName('Sam\u0007')).toBeNull()
    expect(cleanName('Sam\nJo')).toBeNull()
    expect(cleanName(5)).toBeNull()
    expect(cleanName(undefined)).toBeNull()
  })
  it('counts an emoji as one character', () => {
    expect(cleanName('😀'.repeat(40))).not.toBeNull()
    expect(cleanName('😀'.repeat(41))).toBeNull()
  })
})

describe('grade', () => {
  it('is optional, and up to 20 characters', () => {
    expect(cleanGrade(undefined)).toBe('')
    expect(cleanGrade('')).toBe('')
    expect(cleanGrade(' 5th grade ')).toBe('5th grade')
    expect(cleanGrade('g'.repeat(20))).toHaveLength(20)
  })
  it('refuses 21 characters, control characters and non-text', () => {
    expect(cleanGrade('g'.repeat(21))).toBeNull()
    expect(cleanGrade('5\u0000')).toBeNull()
    expect(cleanGrade(5)).toBeNull()
  })
})

describe('initials', () => {
  it('accepts 1 to 3 letters, stored in capitals', () => {
    expect(cleanInitials('m', 'x')).toBe('M')
    expect(cleanInitials('mj', 'x')).toBe('MJ')
    expect(cleanInitials(' mjs ', 'x')).toBe('MJS')
    expect(cleanInitials('É', 'x')).toBe('É')
  })
  it('refuses 4 letters, digits and non-text', () => {
    expect(cleanInitials('ABCD', 'x')).toBeNull()
    expect(cleanInitials('A1', 'x')).toBeNull()
    expect(cleanInitials('12', 'x')).toBeNull()
    expect(cleanInitials(7, 'x')).toBeNull()
  })
  it('checks the length after capitalising, so ß counts as 2', () => {
    expect(cleanInitials('ß', 'x')).toBe('SS')
    expect(cleanInitials('ßß', 'x')).toBeNull()
  })
  it('fills from the name when empty', () => {
    expect(cleanInitials('', 'Mary Jane')).toBe('MJ')
    expect(cleanInitials(undefined, 'sam')).toBe('S')
    expect(cleanInitials('  ', '123')).toBeNull()
  })
})

describe('fillInitials', () => {
  it('takes the first letter of each of the first two words', () => {
    expect(fillInitials('Mary Jane')).toBe('MJ')
    expect(fillInitials('sam')).toBe('S')
    expect(fillInitials('Ann Marie Smith')).toBe('AM')
    expect(fillInitials('  éva  ödön ')).toBe('ÉÖ')
  })
  it('keeps one letter per word when a capital is two letters', () => {
    expect(fillInitials('Ann ßob')).toBe('AS')
    expect(fillInitials('ßob')).toBe('S')
  })
  it('lets a word that does not start with a letter add nothing', () => {
    expect(fillInitials('123')).toBe('')
    expect(fillInitials('3rd Sam')).toBe('S')
    expect(fillInitials('😀')).toBe('')
    expect(fillInitials('')).toBe('')
  })
})

describe('checkChildFields', () => {
  it('returns the cleaned fields, filling initials and grade', () => {
    expect(checkChildFields({ name: ' Mary Jane ' })).toEqual({
      ok: true,
      fields: { name: 'Mary Jane', grade: '', initials: 'MJ' },
    })
    expect(checkChildFields({ name: 'Sam', grade: '4th', initials: 'sx' })).toEqual({
      ok: true,
      fields: { name: 'Sam', grade: '4th', initials: 'SX' },
    })
  })
  it('names the first field that is wrong', () => {
    expect(checkChildFields({ name: '' })).toEqual({ ok: false, error: 'bad_name' })
    expect(checkChildFields({ name: 'Sam', grade: 'g'.repeat(21) })).toEqual({
      ok: false,
      error: 'bad_grade',
    })
    expect(checkChildFields({ name: '123' })).toEqual({ ok: false, error: 'bad_initials' })
  })
})
