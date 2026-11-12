import { useMemo, useRef, useState } from 'react'
import { COPY } from '../../copy'
import { PICTURE_HEAD, parsePassageJson, pictureProblem } from '../../engine'
import type { PassageCheck } from '../../engine'
import { getPassage, replacePassage, savePassage, uploadPicture } from '../../parent/api'
import type { ParentResult } from '../../parent/api'
import { passagePrompt } from '../../parent/passagePrompt'

export interface PassageNote {
  tone: 'info' | 'warn'
  text: string
}

/** What a failed save, open or delete shows. While the page reloads for a sign-in, nothing. */
export function failure(result: Extract<ParentResult<unknown>, { ok: false }>): string | null {
  if (result.error === 'reloading') return null
  if (result.error === 'signed_out') return COPY.parentSignedOut
  if (result.error === 'offline') return COPY.parentOffline
  // The portal ran the same checks before sending, so a refusal here is rare and its detail adds nothing.
  if (result.error === 'bad_passage') return COPY.contentSaveProblem
  if (result.error === 'unknown_passage') return COPY.passagesGone
  if (result.error === 'has_results') return COPY.passagesHasResults
  return COPY.parentServerTrouble
}

/**
 * The state of the Content screen's passage (SPEC §5.3). It lives in the Portal, not in the screen, so the pasted
 * text, a save in flight and its result all survive a visit to another tab, and Save can't be sent twice.
 */
export function usePassageForm() {
  const [draft, setDraftState] = useState('')
  const [saving, setSaving] = useState(false)
  // A saved passage is being opened into the box.
  const [opening, setOpening] = useState(false)
  // The saved passage whose JSON is in the box, while a parent edits it; Save then replaces it (SPEC §5.3).
  const [editing, setEditingState] = useState<{ id: number; title: string } | null>(null)
  // The picture chosen for the passage in the box, sent right after Save (it belongs to a saved passage).
  const [picture, setPicture] = useState<File | null>(null)
  const [pictureNote, setPictureNote] = useState<string | null>(null)
  const [choosingNow, setChoosingState] = useState(false)
  const choosing = useRef(false)
  // Counts saves and deletes, so the list of saved passages reads again.
  const [version, setVersion] = useState(0)
  const [note, setNote] = useState<PassageNote | null>(null)
  // The prompt, shown to copy by hand when this browser won't copy for us.
  const [manual, setManual] = useState<string | null>(null)
  const latest = useRef('')
  const busy = useRef(false)
  // `editing` for code that runs after an await, which would otherwise see the value from its own render.
  const editingNow = useRef<{ id: number; title: string } | null>(null)
  // Counts cancels and deletes, so an open that was on its way when one happened doesn't fill the box after it.
  const epoch = useRef(0)
  const check: PassageCheck | null = useMemo(
    () => (draft.trim() === '' ? null : parsePassageJson(draft)),
    [draft],
  )

  /** Checks a chosen file by its size and first bytes, in plain words, and keeps it for Save when it will do. */
  const choosePicture = async (file: File) => {
    // Save waits for the check: a file still being read would otherwise miss the save it was meant for.
    choosing.current = true
    setChoosingState(true)
    try {
      let head: Uint8Array
      try {
        head = new Uint8Array(await file.slice(0, PICTURE_HEAD).arrayBuffer())
      } catch {
        return setPictureNote(COPY.contentPictureUnreadable)
      }
      const problem = pictureProblem(file.size, head)
      // A file that will not do leaves the picture already chosen where it was.
      if (problem) {
        return setPictureNote(
          problem === 'big'
            ? COPY.contentPictureBig
            : problem === 'empty'
              ? COPY.contentPictureEmpty
              : COPY.contentPictureType,
        )
      }
      setPictureNote(null)
      setPicture(file)
    } finally {
      choosing.current = false
      setChoosingState(false)
    }
  }
  const removePicture = () => {
    setPicture(null)
    setPictureNote(null)
  }

  const setEditing = (value: { id: number; title: string } | null) => {
    editingNow.current = value
    setEditingState(value)
  }
  const refreshList = () => setVersion((v) => v + 1)

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
    if (busy.current || choosing.current || !check?.ok) return
    busy.current = true
    setSaving(true)
    setNote(null)
    // A warning about an earlier pick has done its work once this save goes ahead.
    setPictureNote(null)
    const sent = latest.current
    const title = check.passage.title
    const target = editingNow.current
    const result = target
      ? await replacePassage(target.id, check.passage.source)
      : await savePassage(check.passage.source)
    const done = () => {
      busy.current = false
      setSaving(false)
    }
    if (!result.ok) {
      done()
      const text = failure(result)
      if (text) setNote({ tone: 'warn', text })
      // The passage is gone, so the text can only be added as a new one: it stays, no longer an edit.
      if (target && result.error === 'unknown_passage') {
        setEditing(null)
        refreshList()
      }
      return
    }
    const saved = target ? COPY.contentSavedChanges(title) : COPY.contentSaved(title)
    refreshList()
    // Only the text that was saved is cleared, and with it the edit: text typed meanwhile stays, and is still
    // a change to the same passage.
    if (latest.current === sent) {
      latest.current = ''
      setDraftState('')
      setEditing(null)
    }
    // The picture goes after the passage, which now has an id. Saving stays "in flight" until it is sent, so a second
    // Save can't add the passage again. The passage is saved either way; only the picture can fail now.
    if (picture) {
      const sentPicture = await uploadPicture(result.body.id, picture)
      removePicture()
      done()
      setNote(
        sentPicture.ok
          ? { tone: 'info', text: saved }
          : { tone: 'warn', text: COPY.contentPictureFailed(title) },
      )
      return
    }
    done()
    setNote({ tone: 'info', text: saved })
  }

  /** Loads a saved passage's JSON into the box to change it. Only into an empty box, so nothing typed is lost. */
  const edit = async (id: number) => {
    if (busy.current || latest.current !== '') return
    busy.current = true
    setOpening(true)
    const asked = epoch.current
    const result = await getPassage(id)
    busy.current = false
    setOpening(false)
    // A cancel, a delete or typing happened while it was on its way.
    if (epoch.current !== asked || latest.current !== '') return
    if (!result.ok) {
      const text = failure(result)
      if (text) setNote({ tone: 'warn', text })
      if (result.error === 'unknown_passage') refreshList()
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
    removePicture()
    epoch.current += 1
    latest.current = ''
    setDraftState('')
    setEditing(null)
    setNote(null)
  }

  /** A saved passage is gone (deleted, or already gone): if it was open in the box, the box is emptied. */
  const removed = (id: number, message: PassageNote) => {
    if (editingNow.current?.id === id) cancelEdit()
    epoch.current += 1
    refreshList()
    setNote(message)
  }

  /** Something the list wants to say, in the screen's one status line. */
  const report = (message: PassageNote) => setNote(message)

  // A saved passage can only be opened into an empty box, and not while something is in flight.
  const canEdit = draft === '' && !saving && !opening

  return {
    draft,
    setDraft,
    check,
    saving,
    opening,
    note,
    manual,
    copy,
    save,
    picture,
    pictureNote,
    choosing: choosingNow,
    choosePicture,
    removePicture,
    editing,
    version,
    canEdit,
    edit,
    cancelEdit,
    removed,
    report,
  }
}

export type PassageForm = ReturnType<typeof usePassageForm>
