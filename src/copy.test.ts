import { describe, expect, it } from 'vitest'
import { COPY } from './copy'

describe('old correction log copy', () => {
  it('says Macaroni for one and Macaronis otherwise in the log line', () => {
    expect(COPY.parentLogCorrected('Oct 16', 15, 16, 1, 'x')).toContain('+1 Macaroni:')
    expect(COPY.parentLogCorrected('Oct 16', 16, 15, -1, 'x')).toContain('−1 Macaroni:')
    expect(COPY.parentLogCorrected('Oct 16', 15, 18, 3, 'x')).toContain('+3 Macaronis:')
  })
})
