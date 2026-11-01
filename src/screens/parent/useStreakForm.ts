import { useEffect, useRef, useState, type RefObject } from 'react'
import { COPY } from '../../copy'
import { setStreak } from '../../parent/api'
import type { ParentResult, Summary } from '../../parent/api'
import { streakFields } from '../../parent/streakForm'

type Failed = Extract<ParentResult<unknown>, { ok: false }>

export interface StreakFormState {
  streakText: string
  dayText: string
  step: 'edit' | 'review'
  saving: boolean
  saved: boolean
  /** The refusal or error line, or null. */
  problem: string | null
  setStreakText: (text: string) => void
  setDayText: (text: string) => void
  /** Checks the boxes and opens Review; a refusal shows the problem and stays on the form. */
  review: () => void
  back: () => void
  confirm: () => Promise<void>
}

/**
 * The streak correction form's state: fill in, Review, then Confirm or Back (SPEC §5.3). The boxes fill from
 * her numbers once, so a later refresh never overwrites what a parent is typing.
 */
export function useStreakForm({
  summary,
  live,
  onSaved,
  fail,
}: {
  summary: Summary | null
  live: RefObject<boolean>
  onSaved: () => Promise<void>
  fail: (result: Failed) => string | null
}): StreakFormState {
  const [streakText, setStreakTextState] = useState('')
  const [dayText, setDayTextState] = useState('')
  const [step, setStep] = useState<'edit' | 'review'>('edit')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const prefilled = useRef(false)
  const busy = useRef(false)

  const fill = (s: Summary) => {
    prefilled.current = true
    setStreakTextState(String(s.streak))
    setDayTextState(s.lastDay ?? '')
  }
  useEffect(() => {
    if (summary && !prefilled.current) fill(summary)
  }, [summary])

  const edited = () => {
    setSaved(false)
    setProblem(null)
  }

  return {
    streakText,
    dayText,
    step,
    saving,
    saved,
    problem,
    setStreakText: (text) => {
      edited()
      setStreakTextState(text)
    },
    setDayText: (text) => {
      edited()
      setDayTextState(text)
    },
    review: () => {
      edited()
      if (!streakFields(streakText, dayText)) return setProblem(COPY.parentStreakProblem)
      setStep('review')
    },
    back: () => setStep('edit'),
    confirm: async () => {
      const fields = streakFields(streakText, dayText)
      // One request at a time, so a quick double click saves once.
      if (busy.current || step !== 'review' || !fields) return
      busy.current = true
      setSaving(true)
      const result = await setStreak(fields.streak, fields.lastDay)
      busy.current = false
      if (!live.current) return
      setSaving(false)
      setStep('edit')
      if (!result.ok) return setProblem(fail(result))
      fill(result.body)
      setSaved(true)
      await onSaved()
    },
  }
}
