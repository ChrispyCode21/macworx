// The rules for a child's name, grade and initials (SPEC §5.3). Pure: the parent form and the Worker both
// use it, so what the form accepts is what the Worker accepts.

export const MAX_NAME = 40
export const MAX_GRADE = 20
export const MAX_INITIALS = 3

export interface ChildFields {
  name: string
  grade: string
  initials: string
}

export type FieldError = 'bad_name' | 'bad_grade' | 'bad_initials'

const CONTROL = /\p{Cc}/u
const LETTER = /^\p{L}$/u
const INITIALS = /^\p{L}+$/u

/** Characters as a person counts them: an emoji is 1, not 2. */
const length = (text: string) => Array.from(text).length

/**
 * Initials filled from a name: the first letter of each of the first two words, in capitals
 * ("Mary Jane" gives MJ, "sam" gives S). A word that doesn't start with a letter adds nothing;
 * a name with no such word gives an empty string.
 */
export function fillInitials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? '')
    .filter((first) => LETTER.test(first))
  return Array.from(letters.join('').toUpperCase()).slice(0, MAX_INITIALS).join('')
}

/** The trimmed name, or null when it isn't 1 to 40 characters without control characters. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.trim()
  return length(name) >= 1 && length(name) <= MAX_NAME && !CONTROL.test(name) ? name : null
}

/** The trimmed grade (empty is fine), or null when it is over 20 characters or has control characters. */
export function cleanGrade(raw: unknown): string | null {
  if (raw === undefined || raw === null) return ''
  if (typeof raw !== 'string') return null
  const grade = raw.trim()
  return length(grade) <= MAX_GRADE && !CONTROL.test(grade) ? grade : null
}

/**
 * The initials in capitals: the typed ones when there are any, else those filled from `name`.
 * Null when they aren't 1 to 3 letters (checked after capitalising, so "ß" counts as "SS").
 */
export function cleanInitials(raw: unknown, name: string): string | null {
  if (raw !== undefined && raw !== null && typeof raw !== 'string') return null
  const typed = (raw ?? '').trim()
  const initials = typed === '' ? fillInitials(name) : typed.toUpperCase()
  return length(initials) >= 1 && length(initials) <= MAX_INITIALS && INITIALS.test(initials)
    ? initials
    : null
}

/** A whole child's fields checked together: the cleaned fields, or the first field's error code. */
export function checkChildFields(input: {
  name?: unknown
  grade?: unknown
  initials?: unknown
}): { ok: true; fields: ChildFields } | { ok: false; error: FieldError } {
  const name = cleanName(input.name)
  if (name === null) return { ok: false, error: 'bad_name' }
  const grade = cleanGrade(input.grade)
  if (grade === null) return { ok: false, error: 'bad_grade' }
  const initials = cleanInitials(input.initials, name)
  if (initials === null) return { ok: false, error: 'bad_initials' }
  return { ok: true, fields: { name, grade, initials } }
}
