import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { COPY } from '../../copy'
import { checkWord } from '../../engine'
import { editWord, listWords, removeWord } from '../../parent/api'
import type { ParentResult } from '../../parent/api'
import { PencilIcon, XIcon } from '../../parent/icons'
import { alternatesText, filterWords, parseAlternates, sortWords } from '../../parent/wordList'
import type { WordItem } from '../../parent/wordList'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { Safeguard } from '../../ui/Safeguard'
import { TextField } from '../../ui/TextField'

/** What a failed edit or delete shows. While the page reloads for a sign-in, nothing. */
function failure(result: Extract<ParentResult<unknown>, { ok: false }>): string | null {
  if (result.error === 'reloading') return null
  if (result.error === 'signed_out') return COPY.parentSignedOut
  if (result.error === 'offline') return COPY.parentOffline
  if (result.error === 'duplicate') return COPY.wordsDuplicate
  if (result.error === 'unknown_word') return COPY.wordsGone
  if (result.error === 'bad_word') return COPY.wordsSaveProblem
  return COPY.parentServerTrouble
}

/** One word that is being edited: its three boxes, with Save and Cancel. */
function EditRow({
  word,
  onSaved,
  onCancel,
}: {
  word: WordItem
  onSaved: (word: WordItem) => void
  onCancel: () => void
}) {
  const [text, setText] = useState(word.word)
  const [sentence, setSentence] = useState(word.sentence)
  const [alternates, setAlternates] = useState(alternatesText(word.alternates))
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const save = async () => {
    if (saving) return
    // The same checks the Worker runs, so a refusal here is named in plain words.
    const entry = { word: text, sentence, alternates: parseAlternates(alternates) }
    const checked = checkWord(entry)
    if (!checked.ok) return setProblem(checked.problems.join(' '))
    setSaving(true)
    setProblem(null)
    const result = await editWord(word.id, entry)
    setSaving(false)
    if (!result.ok) return setProblem(failure(result))
    onSaved(result.body.word)
  }

  return (
    <li className="edit-list-row edit-list-form">
      <TextField
        autoFocus
        label={COPY.wordsEditWord}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <TextField
        label={COPY.wordsEditSentence}
        value={sentence}
        onChange={(e) => setSentence(e.target.value)}
      />
      <TextField
        label={COPY.wordsEditAlternates}
        hint={COPY.wordsEditAlternatesHint}
        value={alternates}
        onChange={(e) => setAlternates(e.target.value)}
      />
      {problem && (
        <Safeguard tone="warn" role="alert">
          {problem}
        </Safeguard>
      )}
      <div className="edit-list-actions">
        <Button variant="primary" disabled={saving} onClick={() => void save()}>
          {saving ? COPY.contentSaving : COPY.wordsEditSave}
        </Button>
        <Button variant="secondary" disabled={saving} onClick={onCancel}>
          {COPY.wordsEditCancel}
        </Button>
      </div>
    </li>
  )
}

/**
 * The Edit list dialog (SPEC §5.3): every word with its sentence and alternates, a search box, and for each word a
 * pencil to edit it and an [x] to delete it, which asks first. It reads the list each time it opens.
 */
export function EditListDialog({
  open,
  onClose,
  returnFocusTo,
}: {
  open: boolean
  onClose: () => void
  returnFocusTo: RefObject<HTMLElement | null>
}) {
  // Escape ends an edit or a delete question first, and only then the dialog (the list sets this).
  const escape = useRef<() => boolean>(() => false)
  return (
    <Dialog
      open={open}
      title={COPY.wordsEditHeading}
      closeLabel={COPY.wordsEditClose}
      onClose={onClose}
      onEscape={() => escape.current()}
      returnFocusTo={returnFocusTo}
    >
      <EditList escape={escape} />
    </Dialog>
  )
}

function EditList({ escape }: { escape: RefObject<() => boolean> }) {
  const [words, setWords] = useState<WordItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [removing, setRemoving] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const rows = useRef<HTMLUListElement>(null)
  const search = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let live = true
    void listWords().then((result) => {
      if (!live) return
      if (result.ok) setWords(result.body.words)
      else setFailed(true)
    })
    return () => {
      live = false
    }
  }, [])

  // A row's buttons are replaced when it changes, so focus goes to the word's pencil (or the search box when the
  // word is gone), not to nowhere. It is asked for here and done after the next render, when the pencil exists.
  const [focusTarget, setFocusTarget] = useState<{ id: number | null } | null>(null)
  const refocus = (id: number | null) => setFocusTarget({ id })
  useEffect(() => {
    if (!focusTarget) return
    const target =
      focusTarget.id === null
        ? search.current?.querySelector('input')
        : rows.current?.querySelector(`[data-pencil="${focusTarget.id}"]`)
    ;(target as HTMLElement | null | undefined)?.focus()
    setFocusTarget(null)
  }, [focusTarget])

  useEffect(() => {
    escape.current = () => {
      if (editing !== null) {
        refocus(editing)
        setEditing(null)
        return true
      }
      if (deleting !== null && !removing) {
        refocus(deleting)
        setDeleting(null)
        return true
      }
      return false
    }
  }, [escape, editing, deleting, removing])

  const remove = async (word: WordItem) => {
    if (removing) return
    setRemoving(true)
    const result = await removeWord(word.id)
    setRemoving(false)
    setDeleting((current) => (current === word.id ? null : current))
    // A word that is already gone is gone: the list just drops it.
    if (!result.ok && result.error !== 'unknown_word') {
      refocus(word.id)
      return setNote(failure(result))
    }
    setNote(null)
    setWords((all) => (all ?? []).filter((w) => w.id !== word.id))
    refocus(null)
  }

  if (words === null)
    return <p className="parent-note">{failed ? COPY.parentUnavailable : COPY.parentLoading}</p>
  // A word being edited or asked about stays in the list even when the search no longer matches it.
  const matching = new Set(filterWords(words, query).map((w) => w.id))
  const shown = words.filter((w) => matching.has(w.id) || w.id === editing || w.id === deleting)
  return (
    <div className="edit-list">
      <div ref={search}>
        <TextField
          label={COPY.wordsSearchLabel}
          type="search"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {note && (
        <Safeguard tone="warn" role="alert">
          {note}
        </Safeguard>
      )}
      {words.length === 0 && <p className="parent-note">{COPY.wordsNone}</p>}
      {words.length > 0 && shown.length === 0 && <p className="parent-note">{COPY.wordsNoMatch}</p>}
      <ul className="edit-list-rows" ref={rows}>
        {shown.map((word) =>
          editing === word.id ? (
            <EditRow
              key={word.id}
              word={word}
              onCancel={() => {
                setEditing(null)
                refocus(word.id)
              }}
              onSaved={(changed) => {
                // Only this word's form closes: another may have been opened meanwhile.
                setEditing((current) => (current === changed.id ? null : current))
                setWords((all) => sortWords((all ?? []).map((w) => (w.id === changed.id ? changed : w))))
                refocus(changed.id)
              }}
            />
          ) : (
            <li key={word.id} className="edit-list-row">
              <div className="edit-list-text">
                <p className="edit-list-word">{word.word}</p>
                {word.alternates.length > 0 && (
                  <p className="parent-note">{COPY.wordsAlsoRight(alternatesText(word.alternates))}</p>
                )}
                {word.sentence && <p className="parent-note">{word.sentence}</p>}
              </div>
              {deleting === word.id ? (
                <div className="edit-list-actions" role="group" aria-label={COPY.wordsDeleteAsk(word.word)}>
                  <span className="edit-list-ask">{COPY.wordsDeleteAsk(word.word)}</span>
                  <Button variant="danger" disabled={removing} onClick={() => void remove(word)}>
                    {COPY.wordsDelete}
                  </Button>
                  <Button
                    variant="secondary"
                    autoFocus
                    disabled={removing}
                    onClick={() => {
                      setDeleting(null)
                      refocus(word.id)
                    }}
                  >
                    {COPY.wordsKeep}
                  </Button>
                </div>
              ) : (
                <div className="edit-list-actions">
                  <Button
                    variant="bare"
                    data-pencil={word.id}
                    aria-label={COPY.wordsEditLabel(word.word)}
                    onClick={() => {
                      setDeleting(null)
                      setEditing(word.id)
                    }}
                  >
                    <PencilIcon size={17} />
                  </Button>
                  <Button
                    variant="bare"
                    aria-label={COPY.wordsDeleteLabel(word.word)}
                    onClick={() => {
                      setEditing(null)
                      setDeleting(word.id)
                    }}
                  >
                    <XIcon size={17} />
                  </Button>
                </div>
              )}
            </li>
          ),
        )}
      </ul>
    </div>
  )
}
