import { describe, expect, it, vi } from 'vitest'
import type { ParentResult } from '../../parent/api'
import { submitAdjust } from './useAdjust'

const fail = (error: string, status = 400): ParentResult<never> => ({ ok: false, status, error })

describe('submitAdjust', () => {
  it('posts the signed amount and the note once, and reports the new balance', async () => {
    const adjustBalance = vi.fn().mockResolvedValue({ ok: true, body: { balance: 25 } })
    const getSummary = vi.fn()
    const out = await submitAdjust(-15, 'Counted twice', { current: true }, { adjustBalance, getSummary })
    expect(adjustBalance).toHaveBeenCalledExactlyOnceWith(-15, 'Counted twice')
    expect(out).toEqual({ kind: 'saved', balance: 25 })
    expect(getSummary).not.toHaveBeenCalled()
  })

  it('reads her balance again after an overdraw reply', async () => {
    const adjustBalance = vi.fn().mockResolvedValue(fail('overdraw', 409))
    const getSummary = vi.fn().mockResolvedValue({ ok: true, body: { balance: 30 } })
    const out = await submitAdjust(-41, 'x', { current: true }, { adjustBalance, getSummary })
    expect(out).toEqual({ kind: 'overdraw', balance: 30 })
  })

  it('reports an unreadable balance after an overdraw reply', async () => {
    const adjustBalance = vi.fn().mockResolvedValue(fail('overdraw', 409))
    const getSummary = vi.fn().mockResolvedValue(fail('offline', 0))
    const out = await submitAdjust(-41, 'x', { current: true }, { adjustBalance, getSummary })
    expect(out.kind).toBe('overdraw_unread')
  })

  it('passes other errors on, such as busy', async () => {
    const adjustBalance = vi.fn().mockResolvedValue(fail('busy', 503))
    const out = await submitAdjust(5, 'x', { current: true }, { adjustBalance, getSummary: vi.fn() })
    expect(out).toMatchObject({ kind: 'error', result: { error: 'busy' } })
  })

  it('says nothing when the page was replaced while the call ran', async () => {
    const live = { current: true }
    const adjustBalance = vi.fn().mockImplementation(async () => {
      live.current = false
      return { ok: true, body: { balance: 60 } }
    })
    const out = await submitAdjust(20, 'x', live, { adjustBalance, getSummary: vi.fn() })
    expect(out).toEqual({ kind: 'stale' })
  })

  it('says nothing when the page was replaced during the balance read', async () => {
    const live = { current: true }
    const adjustBalance = vi.fn().mockResolvedValue(fail('overdraw', 409))
    const getSummary = vi.fn().mockImplementation(async () => {
      live.current = false
      return { ok: true, body: { balance: 30 } }
    })
    expect(await submitAdjust(-41, 'x', live, { adjustBalance, getSummary })).toEqual({ kind: 'stale' })
  })
})
