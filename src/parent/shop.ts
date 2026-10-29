import { REWARDS } from '../engine'

/**
 * Which rewards her balance reaches (SPEC §5.2: a price at most her balance), and how many Macaronis
 * each one still needs. With no balance known, nothing is within reach and there is no count.
 */
export function reachOf(balance: number | null) {
  const rewards = REWARDS.map((reward) => ({
    reward,
    within: balance !== null && balance >= reward.price,
    short: balance === null ? reward.price : Math.max(0, reward.price - balance),
  }))
  const withinCount = balance === null ? null : rewards.filter((r) => r.within).length
  return { rewards, withinCount }
}
