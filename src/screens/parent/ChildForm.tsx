import { useEffect, useRef, useState } from 'react'
import { COPY } from '../../copy'
import { addChild, renameChild } from '../../parent/api'
import type { Child, ParentResult } from '../../parent/api'
import { checkChildFields, cleanName, fillInitials, MAX_GRADE, MAX_INITIALS, MAX_NAME } from '../../parent/childFields'
import { Button } from '../../ui/Button'
import { Segmented } from '../../ui/Segmented'
import { TextField } from '../../ui/TextField'

export type ChildMode = 'add' | 'rename'

/** What a refused save says, in kind words. While the page reloads for a sign-in, nothing. */
function problemText(result: Extract<ParentResult<unknown>, { ok: false }>): string | null {
  switch (result.error) {
    case 'reloading':
      return null
    case 'signed_out':
      return COPY.parentSignedOut
    case 'offline':
      return COPY.parentOffline
    case 'bad_name':
      return COPY.parentChildNameProblem
    case 'bad_grade':
      return COPY.parentChildGradeProblem
    case 'bad_initials':
      return COPY.parentChildInitialsProblem
    case 'busy':
      return COPY.parentBusy
    default:
      return COPY.parentServerTrouble
  }
}

/** The boxes' starting text: nothing to add; the child's own in Rename, with initials left to follow the name. */
function startingFields(mode: ChildMode, child: Child) {
  if (mode === 'add') return { name: '', grade: '', initials: '' }
  const filled = child.initials === fillInitials(child.name)
  return { name: child.name, grade: child.grade, initials: filled ? '' : child.initials }
}

interface Props {
  mode: ChildMode
  onMode: (mode: ChildMode) => void
  /** The selected child: who Rename is for. */
  child: Child
  /** True when the portal wants the Name box focused; `onFocused` says it has been. */
  focusName: boolean
  onFocused: () => void
  onAdded: (child: Child) => void
  onRenamed: (child: Child) => void
}

/** Overview's Children panel (SPEC §5.3): add a child, or rename the selected one (name, grade, initials). */
export function ChildForm({ mode, onMode, child, focusName, onFocused, onAdded, onRenamed }: Props) {
  const [fields, setFields] = useState(() => startingFields(mode, child))
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const nameBox = useRef<HTMLInputElement>(null)

  // Another mode or another child: the boxes start over.
  useEffect(() => {
    setFields(startingFields(mode, child))
    setProblem(null)
  }, [mode, child.id, child.name, child.grade, child.initials])

  useEffect(() => {
    if (!focusName) return
    nameBox.current?.focus()
    onFocused()
  }, [focusName])

  const edit = (patch: Partial<typeof fields>) => {
    setFields({ ...fields, ...patch })
    setNotice(null)
  }

  const onSave = async () => {
    setProblem(null)
    setNotice(null)
    const checked = checkChildFields(fields)
    if (!checked.ok)
      return setProblem(
        checked.error === 'bad_name'
          ? COPY.parentChildNameProblem
          : checked.error === 'bad_grade'
            ? COPY.parentChildGradeProblem
            : COPY.parentChildInitialsProblem,
      )
    // One request at a time, so a quick double click saves once.
    setSaving(true)
    const result =
      mode === 'add' ? await addChild(checked.fields) : await renameChild(child.id, checked.fields)
    setSaving(false)
    if (!result.ok) return setProblem(problemText(result))
    setNotice(
      mode === 'add' ? COPY.parentChildAdded(result.body.name) : COPY.parentChildRenamed(result.body.name),
    )
    if (mode === 'add') onAdded(result.body)
    else onRenamed(result.body)
  }

  return (
    <section className="parent-section" aria-labelledby="children-heading">
      <h2 id="children-heading">{COPY.parentChildrenHeading}</h2>
      <Segmented
        label={COPY.parentChildModeLabel}
        options={[
          { value: 'add', label: COPY.parentChildAddMode },
          { value: 'rename', label: COPY.parentChildRenameMode },
        ]}
        value={mode}
        onChange={(next) => {
          setNotice(null)
          onMode(next)
        }}
      />
      {/* maxLength counts UTF-16 units, so doubling the limit leaves room for emoji and other astral
          characters; the real limit, in characters, is checked on Save (childFields.ts). */}
      <TextField
        ref={nameBox}
        label={COPY.parentChildNameLabel}
        value={fields.name}
        maxLength={MAX_NAME * 2}
        onChange={(e) => edit({ name: e.target.value })}
      />
      <TextField
        label={COPY.parentChildGradeLabel}
        value={fields.grade}
        maxLength={MAX_GRADE * 2}
        onChange={(e) => edit({ grade: e.target.value })}
      />
      <TextField
        label={COPY.parentChildInitialsLabel}
        hint={COPY.parentChildInitialsHint}
        value={fields.initials}
        placeholder={fillInitials(fields.name)}
        maxLength={MAX_INITIALS * 2}
        autoCapitalize="characters"
        onChange={(e) => edit({ initials: e.target.value })}
      />
      <Button onClick={onSave} disabled={saving || cleanName(fields.name) === null}>
        {COPY.parentChildSave}
      </Button>
      {problem && (
        <p className="parent-problem" role="alert">
          {problem}
        </p>
      )}
      <p role="status">{notice ?? ''}</p>
    </section>
  )
}
