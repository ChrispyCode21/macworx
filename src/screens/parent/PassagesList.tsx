import { useEffect, useRef, useState } from 'react'
import { COPY } from '../../copy'
import { listPassages, removePassage } from '../../parent/api'
import type { PassageItem } from '../../parent/api'
import { PencilIcon, XIcon } from '../../parent/icons'
import { Button } from '../../ui/Button'
import { Pending } from './Pending'
import { failure } from './usePassageForm'
import type { PassageForm } from './usePassageForm'

type ListForm = Pick<PassageForm, 'version' | 'edit' | 'removed' | 'report' | 'editing' | 'canEdit' | 'draft'>

/**
 * The saved passages (SPEC §5.3): title, minutes, questions and times read, each with Edit, which loads its JSON into
 * the box, and Delete, which asks first. It reads the list when it opens and again after each save or delete. What
 * it has to say goes to the form's status line, which is always on the screen.
 */
export function PassagesList({ form }: { form: ListForm }) {
  const { version, edit, removed, report, editing, canEdit, draft } = form
  const [items, setItems] = useState<PassageItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [removing, setRemoving] = useState(false)
  const heading = useRef<HTMLParagraphElement>(null)
  const rows = useRef<HTMLUListElement>(null)

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

  // The ask and the Delete button go when they are used, so focus is sent somewhere real: the row's [x] after Keep or
  // a refusal, and the list's heading once a passage is gone. It is asked for here and done after the next render.
  const [focusTarget, setFocusTarget] = useState<{ id: number | null } | null>(null)
  useEffect(() => {
    if (!focusTarget) return
    const target =
      focusTarget.id === null
        ? heading.current
        : rows.current?.querySelector(`[data-passage-x="${focusTarget.id}"]`)
    ;(target as HTMLElement | null | undefined)?.focus()
    setFocusTarget(null)
  }, [focusTarget])

  const remove = async (item: PassageItem) => {
    if (removing) return
    setRemoving(true)
    const result = await removePassage(item.id)
    setRemoving(false)
    setDeleting(null)
    // A passage that is already gone is gone: the list just drops it.
    if (result.ok || result.error === 'unknown_passage') {
      setFocusTarget({ id: null })
      return removed(
        item.id,
        result.ok
          ? { tone: 'info', text: COPY.passagesDeleted(item.title) }
          : { tone: 'warn', text: COPY.passagesGone },
      )
    }
    setFocusTarget({ id: item.id })
    const text = failure(result)
    if (text) report({ tone: 'warn', text })
  }

  return (
    <div className="content-passages">
      <p className="content-helper-title" ref={heading} tabIndex={-1}>
        {COPY.passagesHeading}
      </p>
      {items === null && <Pending failed={failed} />}
      {items !== null && failed && <p className="parent-note">{COPY.parentUnavailable}</p>}
      {items?.length === 0 && <p className="parent-note">{COPY.passagesNone}</p>}
      {items !== null && items.length > 0 && !canEdit && draft !== '' && (
        <p className="parent-note">{COPY.passagesFinishFirst}</p>
      )}
      <ul className="edit-list-rows" ref={rows}>
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
                <Button
                  variant="secondary"
                  autoFocus
                  disabled={removing}
                  onClick={() => {
                    setDeleting(null)
                    setFocusTarget({ id: item.id })
                  }}
                >
                  {COPY.wordsKeep}
                </Button>
              </div>
            ) : (
              <div className="edit-list-actions">
                <Button
                  variant="bare"
                  aria-label={COPY.passagesEditLabel(item.title)}
                  disabled={!canEdit || editing !== null}
                  onClick={() => {
                    setDeleting(null)
                    void edit(item.id)
                  }}
                >
                  <PencilIcon size={17} />
                </Button>
                <Button
                  variant="bare"
                  data-passage-x={item.id}
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
