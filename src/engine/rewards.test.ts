import { describe, expect, it } from 'vitest'
import { REWARDS, type RewardId } from './config'
import { payout } from './payout'
import { addDays, nextStreak, type StreakState } from './streak'

// SPEC §7.R: one all-correct 20-problem assignment a day, starting a fresh streak.
// Returns the first day her balance reaches the price, and the balances the day before and that day.
function dayAffordable(price: number) {
  let state: StreakState = { streak: 0, lastDay: null }
  let balance = 0
  for (let day = 1; day <= 400; day++) {
    const before = balance
    const result = nextStreak(state, addDays('2026-01-01', day - 1))
    balance += payout({ correct: 20, problemCount: 20, ...result }).total
    state = result
    if (balance >= price) return { day, before, after: balance }
  }
  throw new Error(`Never affordable in 400 days: ${price}`)
}

const reward = (id: RewardId) => REWARDS.find((r) => r.id === id)!

describe('rewards (SPEC §6.7)', () => {
  it('R1: Ice Cream (30) → 25 after day 1, 51 after day 2: day 2', () => {
    expect(reward('ice-cream')).toMatchObject({ name: 'Ice Cream', price: 30 })
    expect(dayAffordable(30)).toEqual({ day: 2, before: 25, after: 51 })
  })

  it('R2: Pet Store (75) → 51 after day 2, 78 after day 3: day 3', () => {
    expect(reward('pet-store')).toMatchObject({ name: 'Pet Store', price: 75 })
    expect(dayAffordable(75)).toEqual({ day: 3, before: 51, after: 78 })
  })

  it('R3: Camping (300) → 295 after day 10, 329 after day 11: day 11', () => {
    expect(reward('camping')).toMatchObject({ name: 'Camping', price: 300 })
    expect(dayAffordable(300)).toEqual({ day: 11, before: 295, after: 329 })
  })

  it('R4: Puppy (10,000) → 9,985 after day 295, 10,019 after day 296: day 296', () => {
    expect(reward('puppy')).toMatchObject({ name: 'Puppy', price: 10000 })
    expect(dayAffordable(10000)).toEqual({ day: 296, before: 9985, after: 10019 })
  })
})
