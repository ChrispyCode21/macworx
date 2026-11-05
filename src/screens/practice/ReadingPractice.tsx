import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { COPY } from '../../copy'
import { checkChoice } from '../../engine'
import { ArrowLeftIcon, BookOpenIcon, CheckIcon } from '../../practice/icons'
import { READING_COUNT, READING_PASSAGE } from '../../practice/samples'
import type { HomeNumbers, PracticeChild } from '../../sync/projection'
import { Button } from '../../ui/Button'
import { READY_AFTER_MS, useReadyAfter, whenReady } from '../../ui/useReadyAfter'
import { BackToHomeButton } from './BackToHomeButton'
import { NextButton } from './NextButton'
import { PracticeFrame } from './PracticeFrame'

interface Props {
  numbers?: HomeNumbers
  child?: PracticeChild | null
  /** Back to Home: the crumb, and the button after Done. Nothing is kept (SPEC §5.5 step 3). */
  onBack: () => void
}

const LETTERS = ['A', 'B', 'C']
const { questions } = READING_PASSAGE

/**
 * Check answers sits where the passage's Next just was. For a moment after the questions open it ignores taps,
 * so a double tap on Next can't also check her answers (SPEC §5.1 step 4).
 */
function CheckAnswersButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  const ready = useReadyAfter(READY_AFTER_MS)
  return (
    <Button
      variant="action"
      disabled={disabled}
      data-ready={ready || undefined}
      onClick={whenReady(ready, onClick)}
    >
      {COPY.checkAnswers}
      <CheckIcon />
    </Button>
  )
}

/** Reading sample practice: one passage and its questions, checked on the iPad. Nothing is recorded, sent or paid (SPEC §5.5). */
export function ReadingPractice({ numbers, child, onBack }: Props) {
  // Frozen when the screen opens, so a background sync can't change the top bar mid-practice.
  const [shownNumbers] = useState(() => numbers)
  const [shownChild] = useState(() => child)
  const [view, setView] = useState<'passage' | 'questions'>('passage')
  // Her choices and the check outlive the passage screen, so Read again keeps them.
  const [chosen, setChosen] = useState<(number | null)[]>(() => questions.map(() => null))
  const [checked, setChecked] = useState(false)
  const [finished, setFinished] = useState(false)
  const titleId = useId()
  const choiceRefs = useRef<(HTMLButtonElement | null)[][]>([])

  // Next unmounts the passage, so focus would fall to the page. Send it to the first question's choices.
  useEffect(() => {
    if (view !== 'questions' || checked) return
    const roving = chosen[0] ?? 0
    choiceRefs.current[0]?.[roving]?.focus()
    // Only when the questions open, not on every choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  const answered = chosen.filter((c) => c !== null).length
  const right = (q: number) => {
    const c = chosen[q]
    return checked && c !== null && checkChoice(c, questions[q].answer)
  }
  const responseFor = (q: number) =>
    right(q) ? COPY.cheers[q % COPY.cheers.length] : COPY.readingBestAnswer(LETTERS[questions[q].answer])

  // Arrow keys move through one question's choices and pick the one they land on, as a radio group does.
  const onChoiceKey = (e: KeyboardEvent, q: number, from: number) => {
    const step =
      e.key === 'ArrowDown' || e.key === 'ArrowRight'
        ? 1
        : e.key === 'ArrowUp' || e.key === 'ArrowLeft'
          ? -1
          : 0
    if (step === 0) return
    e.preventDefault()
    const n = questions[q].choices.length
    const to = (from + step + n) % n
    setChosen((c) => c.map((v, i) => (i === q ? to : v)))
    choiceRefs.current[q]?.[to]?.focus()
  }

  const onPassage = view === 'passage' && !finished
  const progress = onPassage
    ? { label: COPY.readingProgressRead, done: 1, total: 2 }
    : { label: COPY.readingProgressQuestions, done: 2, total: 2 }
  const announcement = finished
    ? COPY.readingDone
    : checked
      ? questions.map((q, i) => `${COPY.questionEyebrow(i + 1, q.skill)} ${responseFor(i)}`).join(' ')
      : ''

  return (
    <PracticeFrame
      numbers={shownNumbers}
      child={shownChild}
      subject={COPY.subjectReading}
      title={onPassage ? COPY.readingTitle : READING_PASSAGE.title}
      progress={progress}
      backLabel={COPY.back}
      onBack={onBack}
      note={
        finished ? undefined : onPassage ? COPY.readingNote(READING_COUNT) : COPY.readingChosenNote(answered)
      }
      noteIcon={finished ? undefined : <BookOpenIcon size={20} />}
      actions={
        finished ? (
          <BackToHomeButton key="home" onClick={onBack} />
        ) : onPassage ? (
          <NextButton key="next" label={COPY.next} onClick={() => setView('questions')} />
        ) : (
          <>
            <Button variant="action-secondary" onClick={() => setView('passage')}>
              {COPY.readAgain}
              <ArrowLeftIcon size={20} />
            </Button>
            {checked ? (
              <NextButton key="done" label={COPY.done} onClick={() => setFinished(true)} />
            ) : (
              <CheckAnswersButton
                key="check"
                disabled={answered < READING_COUNT}
                onClick={() => setChecked(true)}
              />
            )}
          </>
        )
      }
    >
      {/* Always mounted, outside the panels, so VoiceOver announces the responses and the finished message as the text changes. */}
      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>
      {finished ? (
        <section className="practice-panel practice-done">
          <p className="practice-done-title">{COPY.readingDone}</p>
        </section>
      ) : onPassage ? (
        <div className="practice-reading practice-reading-passage">
          <section className="practice-panel practice-passage" tabIndex={0} aria-labelledby={titleId}>
            <div className="practice-passage-head">
              <p className="practice-eyebrow">
                {COPY.readingEyebrow(READING_PASSAGE.kind, READING_PASSAGE.minutes)}
              </p>
              <h2 id={titleId} className="practice-passage-title">
                {READING_PASSAGE.title}
              </h2>
            </div>
            <div className="practice-passage-text">
              {READING_PASSAGE.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </section>
          <aside className="practice-panel-soft practice-companion">
            <BookOpenIcon size={24} />
            <p className="practice-guide-title">{COPY.readingGuideTitle}</p>
            <p className="practice-guide-text">{READING_PASSAGE.hint}</p>
          </aside>
        </div>
      ) : (
        <div className="practice-reading practice-reading-questions">
          {questions.map((item, q) => (
            <section key={item.question} className="practice-panel practice-question-card">
              <p className="practice-eyebrow practice-eyebrow-question">
                {COPY.questionEyebrow(q + 1, item.skill)}
              </p>
              <p className="practice-question">{item.question}</p>
              <div className="practice-reading-choices" role="radiogroup" aria-label={item.question}>
                {item.choices.map((text, i) => {
                  const result = checked && i === chosen[q] ? (right(q) ? 'right' : 'not-right') : undefined
                  return (
                    <Button
                      key={text}
                      ref={(el) => {
                        ;(choiceRefs.current[q] ??= [])[i] = el
                      }}
                      variant="choice"
                      role="radio"
                      aria-checked={i === chosen[q]}
                      tabIndex={i === (chosen[q] ?? 0) ? 0 : -1}
                      onKeyDown={(e) => onChoiceKey(e, q, i)}
                      disabled={checked}
                      data-result={result}
                      onClick={() => setChosen((c) => c.map((v, j) => (j === q ? i : v)))}
                    >
                      <span className="choice-marker">{LETTERS[i]}</span>
                      <span className="answer-choice">{text}</span>
                      {result === 'right' && <CheckIcon size={22} />}
                    </Button>
                  )
                })}
              </div>
              {checked ? (
                <div className="response practice-reading-response">
                  <p className={right(q) ? 'response-lead' : 'response-equation'}>{responseFor(q)}</p>
                </div>
              ) : (
                <p className="practice-footnote">{COPY.readingChooseOne}</p>
              )}
            </section>
          ))}
        </div>
      )}
    </PracticeFrame>
  )
}
