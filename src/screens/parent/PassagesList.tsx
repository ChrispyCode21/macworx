import { useEffect, useState } from 'react'
import { COPY } from '../../copy'
import { listPassages, removePassage } from '../../parent/api'
import type { ParentResult, PassageItem } from '../../parent/api'
import { PencilIcon, XIcon } from '../../parent/icons'
import { Button } from '../../ui/Button'
import { Safeguard } from '../../ui/Safeguard'
import { Pending } from './Pending'
import type { PassageForm } from './usePassageForm'

/** What a failed delete shows. While the page reloads for a sign-in, nothing. */
function failure(result: Extract<ParentResult<unknown>, { ok: false }>): string | null {
  if (result.error === 'reloading') return null
  if (result.error === 'signed_out') return COPY.parentSignedOut
  if (result.error === 'offline') return COPY.parentOffline
  if (result.error === 'has_results') return COPY.passagesHasResults
  if (result.error === 'unknown_passage') return COPY.passagesGone
  return COPY.parentServerTrouble
}

/**
 * The saved passages (SPEC §5.3): title, minutes, questions and times read, each with Edit, which loads its JSON into
 * the box, and Delete, which asks first. It reads the list when it opens and again after each save or delete.
 */
export function PassagesList({
  form,
}: {
  form: Pick<PassageForm, 'version' | 'edit' | 'removed' | 'editing'>
}) {
  const { version, edit, removed, editing } = form
  const [items, setItems] = useState<PassageItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [removing, setRemoving] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  useEffect(() => {
    let current = true
    void listPassages().then((result) => {
      if (!current) return
      setFailed(!result.ok)
      if (result.ok) setItems(result.body.passages)
    })
    return () => {
      current = false
    }
  }, [version])

  const remove = async (item: PassageItem) => {
    if (removing) return
    setRemoving(true)
    setNote(null)
    const result = await removePassage(item.id)
    setRemoving(false)
    setDeleting(null)
    if (!result.ok) return setNote(failure(result))
    setNote(COPY.passagesDeleted(item.title))
    removed(item.id)
  }

  return (
    <div className="content-passages">
      <p className="content-helper-title">{COPY.passagesHeading}</p>
      {note && (
        <Safeguard tone="info" role="status">
          {note}
        </Safeguard>
      )}
      {items === null && <Pending failed={failed} />}
      {items?.length === 0 && <p className="parent-note">{COPY.passagesNone}</p>}
      <ul className="edit-list-rows">
        {items?.map((item) => (
          <li key={item.id} className="edit-list-row">
            <div className="edit-list-text">
              <p className="edit-list-word">{item.title}</p>
              <p className="parent-note">{COPY.passagesMeta(item.minutes, item.questions, item.timesRead)}</p>
            </div>
            {deleting === item.id ? (
              <div className="edit-list-actions" role="group" aria-label={COPY.passagesDeleteAsk(item.title)}>
                <span className="edit-list-ask">{COPY.passagesDeleteAsk(item.title)}</span>
                <Button variant="danger" disabled={removing} onClick={() => void remove(item)}>
                  {COPY.wordsDelete}
                </Button>
                <Button variant="secondary" autoFocus disabled={removing} onClick={() => setDeleting(null)}>
                  {COPY.wordsKeep}
                </Button>
              </div>
            ) : (
              <div className="edit-list-actions">
                <Button
                  variant="bare"
                  aria-label={COPY.passagesEditLabel(item.title)}
                  aria-pressed={editing?.id === item.id}
                  onClick={() => {
                    setDeleting(null)
                    void edit(item.id)
                  }}
                >
                  <PencilIcon size={17} />
                </Button>
                <Button
                  variant="bare"
                  aria-label={COPY.passagesDeleteLabel(item.title)}
                  onClick={() => setDeleting(item.id)}
                >
                  <XIcon size={17} />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
