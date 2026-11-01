import { describe, expect, it } from 'vitest'
import { streakFields } from './streakForm'

describe('streak form boxes (SPEC §7.T)', () => {
  it('T10: sends the boxes as the Worker wants them', () => {
    expect(streakFields('7', '2026-10-16')).toEqual({ streak: 7, lastDay: '2026-10-16' })
    expect(streakFields('0', '')).toEqual({ streak: 0, lastDay: null })
    expect(streakFields('3', '')).toBeNull()
    for (const text of ['3651', '2.5', '-1', '', 'abc']) expect(streakFields(text, '2026-10-16'), text).toBeNull()
    expect(streakFields('3650', '2026-10-16')).toEqual({ streak: 3650, lastDay: '2026-10-16' })
  })
})
