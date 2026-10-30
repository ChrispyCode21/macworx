import { describe, expect, it } from 'vitest'
import { COPY } from './copy'

describe('device sync copy', () => {
  it('words the last-synced line', () => {
    expect(COPY.parentNoResultsYet).toBe('No results yet')
    expect(COPY.parentSyncedToday('4:05 pm')).toBe('Synced today, 4:05 pm')
    expect(COPY.parentSyncedOn('Oct 12')).toBe('Synced Oct 12')
  })
})

describe('old correction log copy', () => {
  it('says Macaroni for one and Macaronis otherwise in the log line', () => {
    expect(COPY.parentLogCorrected('Oct 16', 15, 16, 1, 'x')).toContain('+1 Macaroni:')
    expect(COPY.parentLogCorrected('Oct 16', 16, 15, -1, 'x')).toContain('−1 Macaroni:')
    expect(COPY.parentLogCorrected('Oct 16', 15, 18, 3, 'x')).toContain('+3 Macaronis:')
  })
})

describe('pairing copy', () => {
  it('words the safeguard with the child, balance and streak', () => {
    expect(COPY.parentDisconnectSafe('Mia', 140, 6)).toBe(
      "Removing a device stops it from saving progress for Mia. Mia's synced homework, 140 Macaronis and 6-day streak stay safe.",
    )
    expect(COPY.parentDisconnectSafe('Mia', 1, 0)).toContain('1 Macaroni and 0-day streak')
    expect(COPY.parentDisconnectSafe('Mia', 1234, 1)).toContain('1,234 Macaronis and 1-day streak')
  })

  it('counts down in minutes', () => {
    expect(COPY.parentCodeExpires(10)).toBe('Expires in 10 minutes.')
    expect(COPY.parentCodeExpires(1)).toBe('Expires in 1 minute.')
  })

  it('calls the thing being paired a device', () => {
    const lines = [
      COPY.pairThisIpad,
      COPY.pairTitle,
      COPY.paired,
      COPY.pairOffline,
      COPY.parentPairTitle,
      COPY.parentPairBody('Mia'),
      COPY.parentNameLabel,
      COPY.parentNameHint,
      COPY.parentMakeCode,
      COPY.parentDisconnectNote,
      COPY.parentAccessBody,
    ]
    for (const line of lines) expect(line).not.toMatch(/ipad/i)
    expect(COPY.pairThisIpad).toBe('Pair this device')
    expect(COPY.paired).toBe('This device is paired!')
  })
})
