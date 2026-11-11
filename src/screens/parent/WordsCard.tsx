import { COPY } from '../../copy'
import { Button } from '../../ui/Button'
import { Panel } from '../../ui/Panel'
import { Safeguard } from '../../ui/Safeguard'
import { SectionHeading } from '../../ui/SectionHeading'
import { TextField } from '../../ui/TextField'
import type { WordsForm } from './useWordsForm'

/**
 * The Spelling card on the Content screen (SPEC §5.3): type or paste words, one per line or separated by commas.
 * A line can be `word: sentence` or `word/alternate`. Its state is the Portal's (`useWordsForm`).
 */
export function WordsCard({ form }: { form: WordsForm }) {
  const { draft, setDraft, count, problems, saving, note, save } = form
  return (
    <Panel className="content-card words-card" aria-label={COPY.wordsHeading}>
      <div className="content-card-head">
        <p className="portal-eyebrow">{COPY.wordsEyebrow}</p>
        <SectionHeading>{COPY.wordsHeading}</SectionHeading>
        <p className="parent-note">{COPY.wordsSub}</p>
      </div>

      <TextField
        multiline
        rows={10}
        label={COPY.wordsLabel}
        hint={COPY.wordsHint}
        hintFirst
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      <div className="words-count">
        <p className="parent-note">{COPY.wordsCount(count)}</p>
        <p className="parent-note">{COPY.wordsBlankLines}</p>
      </div>

      {/* Always mounted, so a screen reader hears each change to it once, not a new alert on every keystroke. */}
      <div className="content-checks" aria-live="polite">
        {problems.length > 0 && (
          <>
            <Safeguard tone="warn">{COPY.wordsFixHeading}</Safeguard>
            <ul className="content-problems">
              {problems.map((problem, i) => (
                <li key={`${i}-${problem}`}>{problem}</li>
              ))}
            </ul>
          </>
        )}
        {note && <Safeguard tone={note.tone}>{note.text}</Safeguard>}
      </div>

      <hr className="parent-divider" />
      <p className="parent-note">{COPY.wordsUse}</p>
      <Button
        variant="primary"
        disabled={count === 0 || problems.length > 0 || saving}
        onClick={() => void save()}
      >
        {saving ? COPY.contentSaving : COPY.wordsSave}
      </Button>
    </Panel>
  )
}
