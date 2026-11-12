import { useMemo, useRef, useState } from 'react'
import { COPY } from '../../copy'
import { parsePassageJson } from '../../engine'
import type { PassageCheck } from '../../engine'
import { getPassage, replacePassage, savePassage } from '../../parent/api'
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
  if (result.error === 'unknown_passage') return COPY.passagesGone
  return COPY.parentServerTrouble
}

/**
 * The state of the Content screen's passage (SPEC §5.3). It lives in the Portal, not in the screen, so the pasted
 * text, a save in flight and its result all survive a visit to another tab, and Save can't be sent twice.
 */
export function usePassageForm() {
  const [draft, setDraftState] = useState('')
  const [saving, setSaving] = useState(false)
  // The saved passage whose JSON is in the box, while a parent edits it; Save then replaces it (SPEC §5.3).
  const [editing, setEditing] = useState<{ id: number; title: string } | null>(null)
  // Counts saves and deletes, so the list of saved passages reads again.
  const [version, setVersion] = useState(0)
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
    const target = editing
    const result = target
      ? await replacePassage(target.id, check.passage.source)
      : await savePassage(check.passage.source)
    busy.current = false
    setSaving(false)
    if (!result.ok) {
      const text = failure(result)
      if (text) setNote({ tone: 'warn', text })
      return
    }
    setNote({ tone: 'info', text: target ? COPY.contentSavedChanges(title) : COPY.contentSaved(title) })
    setEditing((now) => (now?.id === target?.id ? null : now))
    setVersion((v) => v + 1)
    // Only the text that was saved is cleared: a passage pasted meanwhile stays.
    if (latest.current === sent) {
      latest.current = ''
      setDraftState('')
    }
  }

  /** Loads a saved passage's JSON into the box to change it. */
  const edit = async (id: number) => {
    if (busy.current) return
    busy.current = true
    const result = await getPassage(id)
    busy.current = false
    if (!result.ok) {
      const text = failure(result) ?? null
      if (text)
        setNote({
          tone: 'warn',
          text: result.error === 'unknown_passage' ? text : COPY.contentEditLoadFailed,
        })
      return
    }
    const text = JSON.stringify(result.body.passage, null, 2)
    latest.current = text
    setManual(null)
    setDraftState(text)
    setEditing({ id, title: String(result.body.passage.title ?? '') })
    setNote(null)
  }

  /** Leaves editing without saving: the box is emptied. */
  const cancelEdit = () => {
    latest.current = ''
    setDraftState('')
    setEditing(null)
    setNote(null)
  }

  /** A saved passage was deleted: if it was open in the box, the box is emptied. */
  const removed = (id: number) => {
    if (editing?.id === id) cancelEdit()
    setVersion((v) => v + 1)
  }

  return {
    draft,
    setDraft,
    check,
    saving,
    note,
    manual,
    copy,
    save,
    editing,
    version,
    edit,
    cancelEdit,
    removed,
  }
}

export type PassageForm = ReturnType<typeof usePassageForm>
