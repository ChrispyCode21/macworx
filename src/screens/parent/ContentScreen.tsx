import { useMemo, useState } from 'react'
import { COPY } from '../../copy'
import { parsePassageJson } from '../../engine'
import type { CheckedPassage } from '../../engine'
import { savePassage } from '../../parent/api'
import type { ParentResult } from '../../parent/api'
import { CopyIcon, LockKeyholeIcon } from '../../parent/icons'
import { passagePrompt } from '../../parent/passagePrompt'
import { Button } from '../../ui/Button'
import { CodeBox } from '../../ui/CodeBox'
import { Panel } from '../../ui/Panel'
import { Safeguard } from '../../ui/Safeguard'
import { SectionHeading } from '../../ui/SectionHeading'

/** What a failed save shows. While the page reloads for a sign-in, nothing. */
function failure(result: Extract<ParentResult<unknown>, { ok: false }>): string | null {
  if (result.error === 'reloading') return null
  if (result.error === 'signed_out') return COPY.parentSignedOut
  if (result.error === 'offline') return COPY.parentOffline
  if (result.error === 'bad_passage') return COPY.contentSaveProblem
  return COPY.parentServerTrouble
}

/** What the pasted passage will look like in Reading: its title, its length and each question with the right choice marked. */
function Preview({ passage }: { passage: CheckedPassage }) {
  return (
    <section className="content-preview" aria-label={passage.title}>
      <h3>{passage.title}</h3>
      <p className="parent-note">{COPY.contentPreviewMeta(passage.minutes, passage.paragraphs.length)}</p>
      <ol>
        {passage.questions.map((q, i) => (
          <li key={i}>
            <p>{q.text}</p>
            <ul>
              {q.options.map((option, j) => (
                <li key={j} className={j === q.answer ? 'content-right' : undefined}>
                  {option}
                  {j === q.answer && <span> · {COPY.contentRightMark}</span>}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  )
}

/**
 * The Content screen (SPEC §5.3): where a parent adds practice content that every child shares. Today that is a
 * pasted reading passage; the words card comes with the spelling list. The pasted text is the Portal's, so it
 * survives a switch to another tab.
 */
export function ContentScreen({ draft, onDraft }: { draft: string; onDraft: (text: string) => void }) {
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<{ tone: 'info' | 'warn'; text: string } | null>(null)
  const check = useMemo(() => (draft.trim() === '' ? null : parsePassageJson(draft)), [draft])

  const change = (text: string) => {
    setNote(null)
    onDraft(text)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(passagePrompt())
      setNote({ tone: 'info', text: COPY.contentCopied })
    } catch {
      setNote({ tone: 'warn', text: COPY.contentCopyUnavailable })
    }
  }

  const save = async () => {
    if (!check?.ok || saving) return
    setSaving(true)
    setNote(null)
    const result = await savePassage(check.passage.source)
    setSaving(false)
    if (!result.ok) {
      const text = failure(result)
      if (text) setNote({ tone: 'warn', text })
      return
    }
    setNote({ tone: 'info', text: COPY.contentSaved(check.passage.title) })
    onDraft('')
  }

  return (
    <div className="content">
      <Panel className="content-card" aria-label={COPY.contentReadingHeading}>
        <div className="content-card-head">
          <p className="portal-eyebrow">{COPY.contentReadingEyebrow}</p>
          <SectionHeading>{COPY.contentReadingHeading}</SectionHeading>
          <p className="parent-note">{COPY.contentReadingSub}</p>
        </div>

        <div className="content-helper">
          <div>
            <p className="content-helper-title">{COPY.contentHelperTitle}</p>
            <p className="parent-note">{COPY.contentHelperLine1}</p>
            <p className="parent-note">{COPY.contentHelperLine2}</p>
          </div>
          <Button variant="secondary" onClick={() => void copy()}>
            <CopyIcon size={16} />
            {COPY.contentCopy}
          </Button>
        </div>

        <CodeBox label={COPY.contentJsonLabel} hint={COPY.contentJsonHint} value={draft} onChange={change} />

        {check?.ok && (
          <>
            <Safeguard tone="info" role="status">
              {COPY.contentValid(check.passage.questions.length)}
            </Safeguard>
            <Preview passage={check.passage} />
          </>
        )}
        {check && !check.ok && (
          <Safeguard tone="warn" role="alert">
            {COPY.contentFixHeading}
            <ul className="content-problems">
              {check.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </Safeguard>
        )}
        {note && (
          <Safeguard tone={note.tone} role={note.tone === 'warn' ? 'alert' : 'status'}>
            {note.text}
          </Safeguard>
        )}

        <div className="content-actions">
          <div>
            <p className="parent-note">{COPY.contentReview}</p>
            <p className="parent-note">{COPY.contentSaveNote}</p>
          </div>
          <Button variant="primary" disabled={!check?.ok || saving} onClick={() => void save()}>
            {saving ? COPY.contentSaving : COPY.contentSave}
          </Button>
        </div>
      </Panel>

      <p className="portal-note">
        <LockKeyholeIcon size={13} />
        {COPY.contentPrivacy}
      </p>
    </div>
  )
}
