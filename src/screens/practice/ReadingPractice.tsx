import { useEffect, useId, useRef, useState } from 'react'
import { COPY } from '../../copy'
import { checkChoice } from '../../engine'
import { ArrowLeftIcon, BookOpenIcon } from '../../practice/icons'
import { LETTERS, READING_COUNT, READING_PASSAGE } from '../../practice/samples'
import type { HomeNumbers, PracticeChild } from '../../sync/projection'
import { Button } from '../../ui/Button'
import { PracticePanel } from '../../ui/PracticePanel'
import { BackToHomeButton } from './BackToHomeButton'
import { CheckAnswersButton } from './CheckAnswersButton'
import { ChoiceGroup, type ChoiceGroupHandle } from './ChoiceGroup'
import { InlineResponse } from './InlineResponse'
import { NextButton } from './NextButton'
import { PracticeDone } from './PracticeDone'
import { PracticeFrame } from './PracticeFrame'

interface Props {
  numbers?: HomeNumbers
  child?: PracticeChild | null
  /** Back to Home: the crumb, and the button after Done. Nothing is kept (SPEC §5.5 step 3). */
  onBack: () => void
}

const { questions } = READING_PASSAGE

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
  const choicesRefs = useRef<(ChoiceGroupHandle | null)[]>([])

  // Next unmounts the passage, so focus would fall to the page. Send it to the first question's choices.
  useEffect(() => {
    if (view !== 'questions' || checked) return
    const roving = chosen[0] ?? 0
    choicesRefs.current[0]?.focus(roving)
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
        <PracticeDone>{COPY.readingDone}</PracticeDone>
      ) : onPassage ? (
        <div className="practice-reading practice-reading-passage">
          <PracticePanel className="practice-passage" tabIndex={0} aria-labelledby={titleId}>
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
          </PracticePanel>
          <PracticePanel as="aside" variant="soft" className="practice-companion">
            <BookOpenIcon size={24} />
            <p className="practice-guide-title">{COPY.readingGuideTitle}</p>
            <p className="practice-guide-text">{READING_PASSAGE.hint}</p>
          </PracticePanel>
        </div>
      ) : (
        <div className="practice-reading practice-reading-questions">
          {questions.map((item, q) => (
            <PracticePanel key={item.question} className="practice-question-card">
              <p className="practice-eyebrow practice-eyebrow-question">
                {COPY.questionEyebrow(q + 1, item.skill)}
              </p>
              <p className="practice-question">{item.question}</p>
              <ChoiceGroup
                handle={(h) => {
                  choicesRefs.current[q] = h
                }}
                className="practice-reading-choices"
                textClass="answer-choice"
                label={item.question}
                choices={item.choices}
                chosen={chosen[q]}
                onChoose={(i) => setChosen((c) => c.map((v, j) => (j === q ? i : v)))}
                checked={checked}
                right={right(q)}
              />
              {checked ? (
                <InlineResponse right={right(q)}>{responseFor(q)}</InlineResponse>
              ) : (
                <p className="practice-footnote">{COPY.readingChooseOne}</p>
              )}
            </PracticePanel>
          ))}
        </div>
      )}
    </PracticeFrame>
  )
}
