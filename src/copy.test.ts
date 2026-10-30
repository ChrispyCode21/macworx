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
