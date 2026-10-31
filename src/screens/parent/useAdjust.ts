import { useRef, useState, type RefObject } from 'react'
import { COPY } from '../../copy'
import { adjustBalance, getSummary } from '../../parent/api'
import type { ParentResult } from '../../parent/api'
import { balanceAfter, checkAdjust, parseAmount } from '../../parent/adjust'
import type { AdjustCheck } from '../../parent/adjust'

type Failed = Extract<ParentResult<unknown>, { ok: false }>

/** What saving one reviewed adjustment came to. */
export type AdjustOutcome =
  | { kind: 'saved'; balance: number }
  | { kind: 'overdraw'; balance: number }
  | { kind: 'overdraw_unread'; result: Failed }
  | { kind: 'error'; result: Failed }
  /** The page was replaced (another child chosen) while the call ran: show nothing. */
  | { kind: 'stale' }

/**
 * Sends one adjustment. A 409 carries no balance, so it is read again for the "She has N Macaronis" line
 * (SPEC §5.3). Pure of React so the outcomes can be tested.
 */
export async function submitAdjust(
  amount: number,
  note: string,
  live: { current: boolean },
  calls = { adjustBalance, getSummary },
): Promise<AdjustOutcome> {
  const result = await calls.adjustBalance(amount, note)
  if (!live.current) return { kind: 'stale' }
  if (result.ok) return { kind: 'saved', balance: result.body.balance }
  if (result.error !== 'overdraw') return { kind: 'error', result }
  const latest = await calls.getSummary()
  if (!live.current) return { kind: 'stale' }
  return latest.ok
    ? { kind: 'overdraw', balance: latest.body.balance }
    : { kind: 'overdraw_unread', result: latest }
}

export interface AdjustState {
  removing: boolean
  amountText: string
  note: string
  step: 'form' | 'review'
  saving: boolean
  /** The success line, or null. */
  notice: string | null
  /** The refusal or error line, or null. */
  problem: string | null
  /** The amount typed as a signed whole number, or null when it can't be an amount yet. */
  amount: number | null
  /** Her balance after that amount, or null when there is no amount or no balance yet. */
  after: number | null
  /** True when the amount would take her balance under 0. */
  below: boolean
  /** Whether Review may be chosen; null while her balance hasn't arrived. */
  check: AdjustCheck | null
  setRemoving: (removing: boolean) => void
  setAmountText: (text: string) => void
  setNote: (note: string) => void
  review: () => void
  back: () => void
  confirm: () => Promise<void>
}

/** The Macaronis adjustment form's state: fill in, Review, then Confirm or Back (SPEC §5.3). */
export function useAdjust({
  balance,
  live,
  onSaved,
  fail,
  summaryFail,
}: {
  balance: number | null
  live: RefObject<boolean>
  onSaved: () => Promise<void>
  fail: (result: Failed) => string | null
  summaryFail: (result: Failed) => string | null
}): AdjustState {
  const [removing, setRemovingState] = useState(false)
  const [amountText, setAmountTextState] = useState('')
  const [note, setNoteState] = useState('')
  const [step, setStep] = useState<'form' | 'review'>('form')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const busy = useRef(false)

  const count = parseAmount(amountText)
  const amount = count === null ? null : removing ? -count : count
  const after = amount === null || balance === null ? null : balanceAfter(balance, amount)
  const check = balance === null ? null : checkAdjust({ amountText, note, removing, balance })

  const edited = () => {
    setNotice(null)
    setProblem(null)
  }

  const confirm = async () => {
    // One request at a time, so a quick double click can't save the same change twice.
    if (busy.current || step !== 'review' || !check?.ok) return
    busy.current = true
    setSaving(true)
    const outcome = await submitAdjust(check.amount, check.note, live)
    busy.current = false
    if (outcome.kind === 'stale') return
    setSaving(false)
    setStep('form')
    if (outcome.kind === 'saved') {
      setAmountTextState('')
      setNoteState('')
      setNotice(COPY.parentSaved(outcome.balance))
    } else if (outcome.kind === 'overdraw') {
      setProblem(COPY.parentOverdraw(outcome.balance))
    } else if (outcome.kind === 'overdraw_unread') {
      setProblem(summaryFail(outcome.result))
    } else {
      setProblem(fail(outcome.result))
    }
    if (outcome.kind === 'saved' || outcome.kind === 'overdraw') await onSaved()
  }

  return {
    removing,
    amountText,
    note,
    step,
    saving,
    notice,
    problem,
    amount,
    after,
    below: after !== null && after < 0,
    check,
    setRemoving: (value) => {
      edited()
      setRemovingState(value)
    },
    setAmountText: (text) => {
      edited()
      setAmountTextState(text)
    },
    setNote: (text) => {
      edited()
      setNoteState(text)
    },
    review: () => {
      if (check?.ok) {
        edited()
        setStep('review')
      }
    },
    back: () => setStep('form'),
    confirm,
  }
}
