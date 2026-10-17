import { describe, expect, it } from 'vitest'
import { REWARDS } from './config'
import { payout } from './payout'
import { nextStreak, type StreakState } from './streak'

// SPEC §7.R: one all-correct 20-problem assignment a day, starting a fresh streak.
// Returns the first day her balance reaches the price, and the balances the day before and that day.
function dayAffordable(price: number) {
  let state: StreakState = { streak: 0, lastDay: null }
  let balance = 0
  for (let day = 1; day <= 31; day++) {
    const before = balance
    const result = nextStreak(state, `2026-10-${String(day).padStart(2, '0')}`)
    balance += payout({ correct: 20, problemCount: 20, ...result }).total
    state = result
    if (balance >= price) return { day, before, after: balance }
  }
  throw new Error(`Never affordable in a month: ${price}`)
}

const price = (name: string) => REWARDS.find((r) => r.name === name)!.price

describe('rewards (SPEC §6.7)', () => {
  it('R1: ice cream (75) → 51 after day 2, 78 after day 3: day 3', () => {
    expect(price('Ice cream')).toBe(75)
    expect(dayAffordable(75)).toEqual({ day: 3, before: 51, after: 78 })
  })

  it('R2: pet shelter visit (100) → 78 after day 3, 106 after day 4: day 4', () => {
    expect(price('Pet shelter visit')).toBe(100)
    expect(dayAffordable(100)).toEqual({ day: 4, before: 78, after: 106 })
  })

  it('R3: camping trip (300) → 295 after day 10, 329 after day 11: day 11', () => {
    expect(price('Camping trip')).toBe(300)
    expect(dayAffordable(300)).toEqual({ day: 11, before: 295, after: 329 })
  })
})
