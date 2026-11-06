import { describe, expect, it } from 'vitest'
import { checkChildFields, cleanGrade, cleanInitials, cleanName, fillInitials } from './childFields'

describe('name', () => {
  it('accepts 1 to 20 characters and trims', () => {
    expect(cleanName('S')).toBe('S')
    expect(cleanName('a'.repeat(20))).toHaveLength(20)
    expect(cleanName('  Mary Jane ')).toBe('Mary Jane')
  })
  it('refuses 0, 21, whitespace-only, control characters and non-text', () => {
    expect(cleanName('')).toBeNull()
    expect(cleanName('a'.repeat(21))).toBeNull()
    expect(cleanName('   ')).toBeNull()
    expect(cleanName('Sam\u0007')).toBeNull()
    expect(cleanName('Sam\nJo')).toBeNull()
    expect(cleanName(5)).toBeNull()
    expect(cleanName(undefined)).toBeNull()
  })
  it('refuses a name with no visible character', () => {
    for (const name of [
      '\u200B',
      '\u200B\u200B',
      ' \u200B ',
      '\u2060',
      '\u00AD',
      '\uFEFF',
      '\u3164',
      '\uFE0F',
      '\u200D',
      '\u115F',
      '\u1160',
      '\uFFA0',
      '\uFE00',
      '\u{E0100}',
      '\u2061',
      '\u200B\u3164\uFE0F',
      // Marks, other format characters, private-use and unassigned code points, and the braille blank.
      '\u2800',
      '\u2800\u2800',
      '\u0301',
      '\u0301\u0308',
      '\uFFF9',
      '\uFFFA\uFFFB',
      '\u0600',
      '\u0605',
      '\uE000',
      '\u0378',
      ' \u2800 \u0301 ',
    ]) {
      expect(cleanName(name), JSON.stringify(name)).toBeNull()
    }
  })
  it('refuses bidi override and isolate characters', () => {
    for (const name of [
      'Sam\u202E',
      'a\u2066b',
      'a\u202A',
      'a\u202E',
      'a\u2066',
      'a\u2069',
      '\u202ESam',
      'S\u202Eam',
      'a\u202B',
      'a\u202C',
      'a\u2067',
      'a\u2068',
    ]) {
      expect(cleanName(name), JSON.stringify(name)).toBeNull()
    }
  })
  it('accepts joiners, marks and invisible characters inside a visible name', () => {
    for (const name of [
      'A\u200CB',
      '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}',
      'Sa\u200Bm',
      'Sam\u200E',
      'Sam\u200F',
      'Sam\u0301',
      'A\u2800B',
      'Sam\uE000',
      '\u0301S',
      'سارة',
    ]) {
      expect(cleanName(name), JSON.stringify(name)).toBe(name)
    }
  })
  it('counts an emoji as one character', () => {
    expect(cleanName('😀'.repeat(20))).not.toBeNull()
    expect(cleanName('😀'.repeat(21))).toBeNull()
  })
})

describe('grade', () => {
  it('is optional, and up to 5 characters', () => {
    expect(cleanGrade(undefined)).toBe('')
    expect(cleanGrade('')).toBe('')
    expect(cleanGrade(' Pre-K ')).toBe('Pre-K')
    expect(cleanGrade('g'.repeat(5))).toHaveLength(5)
  })
  it('counts an emoji as one character', () => {
    expect(cleanGrade('😀'.repeat(5))).not.toBeNull()
    expect(cleanGrade('😀'.repeat(6))).toBeNull()
  })
  it('refuses 6 characters, control characters and non-text', () => {
    expect(cleanGrade('g'.repeat(6))).toBeNull()
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
    expect(checkChildFields({ name: '\u200B' })).toEqual({ ok: false, error: 'bad_name' })
    expect(checkChildFields({ name: 'Sam', grade: 'g'.repeat(6) })).toEqual({
      ok: false,
      error: 'bad_grade',
    })
    expect(checkChildFields({ name: '123' })).toEqual({ ok: false, error: 'bad_initials' })
  })
})
