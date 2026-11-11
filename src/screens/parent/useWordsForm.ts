import { useMemo, useRef, useState } from 'react'
import { COPY } from '../../copy'
import { checkWord, parseWords } from '../../engine'
import type { WordEntry } from '../../engine'
import { addWords } from '../../parent/api'
import type { ParentResult } from '../../parent/api'

export interface WordsNote {
  tone: 'info' | 'warn'
  text: string
}

/** What a failed save shows. While the page reloads for a sign-in, nothing. */
function failure(result: Extract<ParentResult<unknown>, { ok: false }>): string | null {
  if (result.error === 'reloading') return null
  if (result.error === 'signed_out') return COPY.parentSignedOut
  if (result.error === 'offline') return COPY.parentOffline
  // The portal ran the same checks before sending, so a refusal here is rare and its detail adds nothing.
  if (result.error === 'bad_word') return COPY.wordsSaveProblem
  return COPY.parentServerTrouble
}

/** The most problems listed at once; the rest are counted. */
const MAX_LISTED = 10

/**
 * The state of the Content screen's word list (SPEC §5.3). It lives in the Portal, so the pasted words and a save in
 * flight survive a visit to another tab, and Save can't be sent twice.
 */
export function useWordsForm() {
  const [draft, setDraftState] = useState('')
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<WordsNote | null>(null)
  const latest = useRef('')
  const busy = useRef(false)

  const entries: WordEntry[] = useMemo(() => parseWords(draft), [draft])
  // Every entry through the same checks the Worker runs, so a save the portal sends is one the Worker accepts.
  const problems = useMemo(() => {
    const all = entries.flatMap((entry) => {
      const checked = checkWord(entry)
      return checked.ok ? [] : checked.problems
    })
    return all.length > MAX_LISTED
      ? [...all.slice(0, MAX_LISTED), COPY.wordsMoreProblems(all.length - MAX_LISTED)]
      : all
  }, [entries])

  const setDraft = (text: string) => {
    latest.current = text
    setNote(null)
    setDraftState(text)
  }

  const save = async () => {
    if (busy.current || entries.length === 0 || problems.length > 0) return
    busy.current = true
    setSaving(true)
    setNote(null)
    const sent = latest.current
    const result = await addWords(entries)
    busy.current = false
    setSaving(false)
    if (!result.ok) {
      const text = failure(result)
      if (text) setNote({ tone: 'warn', text })
      return
    }
    setNote({ tone: 'info', text: COPY.wordsAdded(result.body.added, result.body.skipped) })
    // Only the text that was saved is cleared: words typed meanwhile stay.
    if (latest.current === sent) {
      latest.current = ''
      setDraftState('')
    }
  }

  return { draft, setDraft, count: entries.length, problems, saving, note, save }
}

export type WordsForm = ReturnType<typeof useWordsForm>
