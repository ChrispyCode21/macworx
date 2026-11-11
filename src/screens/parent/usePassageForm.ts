import { useMemo, useRef, useState } from 'react'
import { COPY } from '../../copy'
import { parsePassageJson } from '../../engine'
import type { PassageCheck } from '../../engine'
import { savePassage } from '../../parent/api'
import type { ParentResult } from '../../parent/api'
import { passagePrompt } from '../../parent/passagePrompt'

export interface PassageNote {
  tone: 'info' | 'warn'
  text: string
}

/** What a failed save shows. While the page reloads for a sign-in, nothing. */
function failure(result: Extract<ParentResult<unknown>, { ok: false }>): string | null {
  if (result.error === 'reloading') return null
  if (result.error === 'signed_out') return COPY.parentSignedOut
  if (result.error === 'offline') return COPY.parentOffline
  // The portal ran the same checks before sending, so a refusal here is rare and its detail adds nothing.
  if (result.error === 'bad_passage') return COPY.contentSaveProblem
  return COPY.parentServerTrouble
}

/**
 * The state of the Content screen's passage (SPEC §5.3). It lives in the Portal, not in the screen, so the pasted
 * text, a save in flight and its result all survive a visit to another tab, and Save can't be sent twice.
 */
export function usePassageForm() {
  const [draft, setDraftState] = useState('')
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<PassageNote | null>(null)
  // The prompt, shown to copy by hand when this browser won't copy for us.
  const [manual, setManual] = useState<string | null>(null)
  const latest = useRef('')
  const busy = useRef(false)
  const check: PassageCheck | null = useMemo(
    () => (draft.trim() === '' ? null : parsePassageJson(draft)),
    [draft],
  )

  const setDraft = (text: string) => {
    latest.current = text
    setNote(null)
    setManual(null)
    setDraftState(text)
  }

  const copy = async () => {
    const prompt = passagePrompt()
    try {
      await navigator.clipboard.writeText(prompt)
      setManual(null)
      setNote({ tone: 'info', text: COPY.contentCopied })
    } catch {
      setNote({ tone: 'warn', text: COPY.contentCopyUnavailable })
      setManual(prompt)
    }
  }

  const save = async () => {
    if (busy.current || !check?.ok) return
    busy.current = true
    setSaving(true)
    setNote(null)
    const sent = latest.current
    const title = check.passage.title
    const result = await savePassage(check.passage.source)
    busy.current = false
    setSaving(false)
    if (!result.ok) {
      const text = failure(result)
      if (text) setNote({ tone: 'warn', text })
      return
    }
    setNote({ tone: 'info', text: COPY.contentSaved(title) })
    // Only the text that was saved is cleared: a passage pasted meanwhile stays.
    if (latest.current === sent) {
      latest.current = ''
      setDraftState('')
    }
  }

  return { draft, setDraft, check, saving, note, manual, copy, save }
}

export type PassageForm = ReturnType<typeof usePassageForm>
