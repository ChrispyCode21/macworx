import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { COPY } from '../../copy'
import { checkWord } from '../../engine'
import { editWord, listWords, removeWord } from '../../parent/api'
import type { ParentResult } from '../../parent/api'
import { PencilIcon, XIcon } from '../../parent/icons'
import { alternatesText, filterWords, parseAlternates } from '../../parent/wordList'
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
      <TextField label={COPY.wordsEditWord} value={text} onChange={(e) => setText(e.target.value)} />
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
        <Button variant="secondary" onClick={onCancel}>
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
  return (
    <Dialog
      open={open}
      title={COPY.wordsEditHeading}
      closeLabel={COPY.wordsEditClose}
      onClose={onClose}
      returnFocusTo={returnFocusTo}
    >
      <EditList />
    </Dialog>
  )
}

function EditList() {
  const [words, setWords] = useState<WordItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [note, setNote] = useState<string | null>(null)

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

  const remove = async (word: WordItem) => {
    const result = await removeWord(word.id)
    setDeleting(null)
    // A word that is already gone is gone: the list just drops it.
    if (!result.ok && result.error !== 'unknown_word') return setNote(failure(result))
    setNote(null)
    setWords((all) => (all ?? []).filter((w) => w.id !== word.id))
  }

  if (words === null)
    return <p className="parent-note">{failed ? COPY.parentUnavailable : COPY.parentLoading}</p>
  const shown = filterWords(words, query)
  return (
    <div className="edit-list">
      <TextField
        label={COPY.wordsSearchLabel}
        type="search"
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {note && (
        <Safeguard tone="warn" role="alert">
          {note}
        </Safeguard>
      )}
      {words.length === 0 && <p className="parent-note">{COPY.wordsNone}</p>}
      {words.length > 0 && shown.length === 0 && <p className="parent-note">{COPY.wordsNoMatch}</p>}
      <ul className="edit-list-rows">
        {shown.map((word) =>
          editing === word.id ? (
            <EditRow
              key={word.id}
              word={word}
              onCancel={() => setEditing(null)}
              onSaved={(changed) => {
                setEditing(null)
                setWords((all) => (all ?? []).map((w) => (w.id === changed.id ? changed : w)))
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
                <div className="edit-list-actions">
                  <span className="edit-list-ask">{COPY.wordsDeleteAsk(word.word)}</span>
                  <Button variant="danger" onClick={() => void remove(word)}>
                    {COPY.wordsDelete}
                  </Button>
                  <Button variant="secondary" onClick={() => setDeleting(null)}>
                    {COPY.wordsKeep}
                  </Button>
                </div>
              ) : (
                <div className="edit-list-actions">
                  <Button
                    variant="bare"
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
