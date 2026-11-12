import { useRef, useState } from 'react'
import { COPY } from '../../copy'
import { Button } from '../../ui/Button'
import { Panel } from '../../ui/Panel'
import { Safeguard } from '../../ui/Safeguard'
import { SectionHeading } from '../../ui/SectionHeading'
import { TextField } from '../../ui/TextField'
import { EditListDialog } from './EditListDialog'
import type { WordsForm } from './useWordsForm'

/**
 * The Spelling card on the Content screen (SPEC §5.3): type or paste words, one per line or separated by commas.
 * A line can be `word: sentence` or `word/alternate`. Its state is the Portal's (`useWordsForm`).
 */
export function WordsCard({ form }: { form: WordsForm }) {
  const { draft, setDraft, count, problems, saving, note, save, advice, addAlternate, removeAlternate } = form
  const [editing, setEditing] = useState(false)
  const editButton = useRef<HTMLButtonElement>(null)
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
        {problems.length > 0 && <Safeguard tone="warn">{COPY.wordsFixHeading}</Safeguard>}
        {note && <Safeguard tone={note.tone}>{note.text}</Safeguard>}
      </div>
      {/* The list itself is outside the live region: it quotes the word being typed, so it changes on every key. */}
      {problems.length > 0 && (
        <ul className="content-problems">
          {problems.map((problem, i) => (
            <li key={`${i}-${problem}`}>{problem}</li>
          ))}
        </ul>
      )}

      {/* Advice from the dictionaries (SPEC §6.11) never blocks Save. Outside the live region, like the list above. */}
      {advice.length > 0 && (
        <ul className="words-advice" aria-label={COPY.wordsAdviceLabel}>
          {advice.map(({ word, advice: said, added }) => (
            <li key={word.toLowerCase()}>
              {said.kind === 'neither' ? (
                <span>{COPY.wordsInNeither(word)}</span>
              ) : (
                <>
                  <span>
                    {COPY.wordsInOne(word, said.from)}{' '}
                    {said.other &&
                      (added ? COPY.wordsAccepting(said.other) : COPY.wordsOfferOther(said.other))}
                  </span>
                  {said.other && (
                    <Button
                      variant="secondary"
                      disabled={saving}
                      aria-label={added ? COPY.wordsRemoveOther(word) : COPY.wordsAddOther(word)}
                      onClick={() => (added ? removeAlternate(word) : addAlternate(word, said.other!))}
                    >
                      {added ? COPY.wordsRemove : COPY.wordsAdd}
                    </Button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <hr className="parent-divider" />
      <p className="parent-note">{COPY.wordsUse}</p>
      <Button
        variant="primary"
        disabled={count === 0 || problems.length > 0 || saving}
        onClick={() => void save()}
      >
        {saving ? COPY.contentSaving : COPY.wordsSave}
      </Button>
      <Button ref={editButton} variant="secondary" onClick={() => setEditing(true)}>
        {COPY.wordsEdit}
      </Button>
      <EditListDialog open={editing} onClose={() => setEditing(false)} returnFocusTo={editButton} />
    </Panel>
  )
}
