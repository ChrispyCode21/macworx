import { useEffect, useId, useRef, useState } from 'react'
import { COPY } from '../../copy'
import { ArrowLeftIcon, BookOpenIcon } from '../../practice/icons'
import { LETTERS } from '../../practice/samples'
import type { HomeNumbers, PracticeChild } from '../../sync/projection'
import { checkReading, leftToAnswer, pairQuestions } from '../../sync/reading'
import type { ReadingPassage, ReadingResult } from '../../sync/reading'
import { Button } from '../../ui/Button'
import { PracticePanel } from '../../ui/PracticePanel'
import { CheckAnswersButton } from './CheckAnswersButton'
import { ChoiceGroup, type ChoiceGroupHandle } from './ChoiceGroup'
import { InlineResponse } from './InlineResponse'
import { NextButton } from './NextButton'
import { PracticeFrame } from './PracticeFrame'

interface Props {
  /** The attempt `start` gave. Kept for this screen's whole life: a Check that has to be retried never calls `start` again. */
  attempt: number
  passage: ReadingPassage
  numbers?: HomeNumbers
  child?: PracticeChild | null
  /** Back to Home: the crumb. Before Check answers it records nothing (SPEC §5.6 step 6). */
  onBack: () => void
  /** Done, once the Worker has recorded the result (SPEC §5.6 step 5). */
  onDone: (result: ReadingResult) => void
}

/**
 * A reading assignment (SPEC §5.6): the passage, then its questions two at a time, then Check answers, which the
 * Worker marks. Her choices live in memory only. Nothing is marked, and no right answer is here, until Check.
 */
export function ReadingAssignment({ attempt, passage, numbers, child, onBack, onDone }: Props) {
  // Frozen when the screen opens, so a background sync can't change the top bar mid-practice.
  const [shownNumbers] = useState(() => numbers)
  const [shownChild] = useState(() => child)
  const [view, setView] = useState<'passage' | 'questions'>('passage')
  const [pairIndex, setPairIndex] = useState(0)
  // Question id -> choice id.
  const [picks, setPicks] = useState<Record<number, number>>({})
  const [result, setResult] = useState<ReadingResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [offline, setOffline] = useState(false)
  const titleId = useId()
  const choicesRefs = useRef<(ChoiceGroupHandle | null)[]>([])

  const { questions } = passage
  const pairs = pairQuestions(questions.length)
  const pair = pairs[Math.min(pairIndex, pairs.length - 1)]
  const lastPair = pairIndex >= pairs.length - 1
  const left = leftToAnswer(questions.length, Object.keys(picks).length)
  const onPassage = view === 'passage'
  const checked = result !== null

  // Next unmounts what was on screen, so focus would fall to the page. Send it to the first question's choices.
  useEffect(() => {
    if (view !== 'questions' || checked) return
    const first = questions[pair[0]]
    const roving = Math.max(
      0,
      first.choices.findIndex((c) => c.id === picks[first.id]),
    )
    choicesRefs.current[0]?.focus(roving)
    // Only when a pair opens, not on every choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, pairIndex])

  const check = async () => {
    if (checking || left > 0) return
    setChecking(true)
    setOffline(false)
    const outcome = await checkReading(
      attempt,
      questions.map((q) => ({ question: q.id, choice: picks[q.id] })),
      new Date(),
    )
    if (outcome.kind === 'checked') setResult(outcome.result)
    else setOffline(true)
    setChecking(false)
  }

  const marked = (id: number) => result?.questions.find((q) => q.id === id)
  const responseFor = (q: ReadingPassage['questions'][number]) => {
    const m = marked(q.id)
    if (!m) return ''
    if (m.explanation) return m.explanation
    const at = q.choices.findIndex((c) => c.id === m.rightChoice)
    return at < 0 ? '' : COPY.readingRightAnswer(LETTERS[at], q.choices[at].text)
  }
  const announcement = checked ? pair.map((i) => responseFor(questions[i])).join(' ') : ''

  const progress = onPassage
    ? { label: COPY.readingProgressRead, done: 1, total: 2 }
    : { label: COPY.readingProgressQuestions, done: 2, total: 2 }
  const note = onPassage
    ? COPY.readingNote(questions.length)
    : offline
      ? COPY.readingCheckOffline
      : !checked && lastPair && left > 0
        ? COPY.readingLeft(left)
        : COPY.readingPairNote(pair[0] + 1, pair[pair.length - 1] + 1, questions.length)

  const minutes = passage.genre
    ? COPY.readingEyebrow(passage.genre, passage.minutes)
    : COPY.readingMinutes(passage.minutes)

  return (
    <PracticeFrame
      numbers={shownNumbers}
      child={shownChild}
      subject={COPY.subjectReading}
      title={onPassage ? COPY.readingTitle : passage.title}
      progress={progress}
      backLabel={COPY.back}
      onBack={onBack}
      note={note}
      noteIcon={<BookOpenIcon size={20} />}
      actions={
        onPassage ? (
          <NextButton key="next" label={COPY.next} onClick={() => setView('questions')} />
        ) : (
          <>
            <Button variant="action-secondary" onClick={() => setView('passage')}>
              {COPY.readAgain}
              <ArrowLeftIcon size={20} />
            </Button>
            {pairIndex > 0 && (
              <Button variant="action-secondary" onClick={() => setPairIndex(pairIndex - 1)}>
                {COPY.back}
              </Button>
            )}
            {!lastPair ? (
              <NextButton
                key={`next-${pairIndex}`}
                label={COPY.next}
                onClick={() => setPairIndex(pairIndex + 1)}
              />
            ) : checked ? (
              <NextButton key="done" label={COPY.done} onClick={() => onDone(result)} />
            ) : (
              <CheckAnswersButton key="check" disabled={left > 0 || checking} onClick={check} />
            )}
          </>
        )
      }
    >
      {/* Always mounted, outside the panels, so VoiceOver announces the responses as the text changes. */}
      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>
      {onPassage ? (
        <div
          className={`practice-reading practice-reading-passage${passage.hint ? '' : ' practice-reading-solo'}`}
        >
          <PracticePanel className="practice-passage" tabIndex={0} aria-labelledby={titleId}>
            <div className="practice-passage-head">
              <p className="practice-eyebrow">{minutes}</p>
              <h2 id={titleId} className="practice-passage-title">
                {passage.title}
              </h2>
            </div>
            <div className="practice-passage-text">
              {passage.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </PracticePanel>
          {passage.hint && (
            <PracticePanel as="aside" variant="soft" className="practice-companion">
              <BookOpenIcon size={24} />
              <p className="practice-guide-title">{COPY.readingGuideTitle}</p>
              <p className="practice-guide-text">{passage.hint}</p>
            </PracticePanel>
          )}
        </div>
      ) : (
        <div className="practice-reading practice-reading-questions">
          {pair.map((qi, slot) => {
            const q = questions[qi]
            const m = marked(q.id)
            const at = q.choices.findIndex((c) => c.id === picks[q.id])
            return (
              <PracticePanel key={q.id} className="practice-question-card">
                <p className="practice-eyebrow practice-eyebrow-question">{COPY.questionNumber(qi + 1)}</p>
                <p className="practice-question">{q.text}</p>
                <ChoiceGroup
                  handle={(h) => {
                    choicesRefs.current[slot] = h
                  }}
                  className="practice-reading-choices"
                  textClass="answer-choice"
                  label={q.text}
                  choices={q.choices.map((c) => c.text)}
                  chosen={at < 0 ? null : at}
                  onChoose={(i) => setPicks((p) => ({ ...p, [q.id]: q.choices[i].id }))}
                  checked={checked}
                  right={m?.right === true}
                />
                {m ? (
                  <InlineResponse right={m.right}>{responseFor(q)}</InlineResponse>
                ) : (
                  <p className="practice-footnote">{COPY.readingChooseOne}</p>
                )}
              </PracticePanel>
            )
          })}
        </div>
      )}
    </PracticeFrame>
  )
}
