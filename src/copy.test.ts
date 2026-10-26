import { describe, expect, it } from 'vitest'
import { COPY } from './copy'

describe('correction copy', () => {
  it('says Macaroni for one and Macaronis otherwise in the log line', () => {
    expect(COPY.parentLogCorrected('Oct 16', 15, 16, 1, 'x')).toContain('+1 Macaroni:')
    expect(COPY.parentLogCorrected('Oct 16', 16, 15, -1, 'x')).toContain('−1 Macaroni:')
    expect(COPY.parentLogCorrected('Oct 16', 15, 18, 3, 'x')).toContain('+3 Macaronis:')
  })

  it('says Macaroni for a balance of one', () => {
    expect(COPY.parentCorrectionOverdraw(1)).toContain('She has 1 Macaroni,')
    expect(COPY.parentCorrectionOverdraw(41)).toContain('She has 41 Macaronis,')
  })
})
