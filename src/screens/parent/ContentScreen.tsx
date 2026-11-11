import { COPY } from '../../copy'
import type { CheckedPassage } from '../../engine'
import { CopyIcon, LockKeyholeIcon } from '../../parent/icons'
import { Button } from '../../ui/Button'
import { CodeBox } from '../../ui/CodeBox'
import { Panel } from '../../ui/Panel'
import { Safeguard } from '../../ui/Safeguard'
import { SectionHeading } from '../../ui/SectionHeading'
import { TextField } from '../../ui/TextField'
import type { PassageForm } from './usePassageForm'
import type { WordsForm } from './useWordsForm'
import { WordsCard } from './WordsCard'

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
 * pasted reading passage; the words card comes with the spelling list. Its state is the Portal's (`usePassageForm`).
 */
export function ContentScreen({ form, words }: { form: PassageForm; words: WordsForm }) {
  const { draft, setDraft, check, saving, note, manual, copy, save } = form
  return (
    <div className="content">
      <div className="content-cards">
        <WordsCard form={words} />
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
          {manual !== null && <TextField label={COPY.contentCopyByHand} multiline readOnly value={manual} />}

          <CodeBox
            label={COPY.contentJsonLabel}
            hint={COPY.contentJsonHint}
            value={draft}
            invalid={check !== null && !check.ok}
            onChange={setDraft}
          />

          {/* Always mounted, so a screen reader hears each change to it once, not a new alert on every keystroke. */}
          <div className="content-checks" aria-live="polite">
            {check?.ok && (
              <>
                <Safeguard tone="info">{COPY.contentValid(check.passage.questions.length)}</Safeguard>
                <Preview passage={check.passage} />
              </>
            )}
            {check && !check.ok && (
              <>
                <Safeguard tone="warn">{COPY.contentFixHeading}</Safeguard>
                <ul className="content-problems">
                  {check.problems.map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
              </>
            )}
            {note && <Safeguard tone={note.tone}>{note.text}</Safeguard>}
          </div>

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
      </div>

      <p className="portal-note">
        <LockKeyholeIcon size={13} />
        {COPY.contentPrivacy}
      </p>
    </div>
  )
}
