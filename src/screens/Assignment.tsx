import { useMemo, useState } from 'react'
import {
  answerValue,
  boxCount,
  deleteDigit,
  entryFor,
  nextBox,
  shownDigits,
  typeDigit,
} from '../assignment/answer'
import { NumberPad } from '../components/NumberPad'
import { StackedProblem } from '../components/StackedProblem'
import { COPY } from '../copy'
import { checkAnswer, generateAssignment } from '../engine'
import { CheckIcon } from '../practice/icons'
import type { HomeNumbers, PracticeChild } from '../sync/projection'
import { Button } from '../ui/Button'
import { formatEquation } from '../ui/format'
import { NextButton } from './practice/NextButton'
import { PracticeFrame } from './practice/PracticeFrame'

interface Props {
  seed: number
  /** The numbers Home showed; the top bar keeps them for the whole assignment. */
  numbers?: HomeNumbers
  /** Her name, grade and initials; the top bar keeps them for the whole assignment too. */
  child?: PracticeChild | null
  /** Her answers in order, one per problem she checked. */
  onFinish: (answers: number[], correct: number) => void
  onLeave: (answers: number[], correct: number) => void
}

/** One assignment, a problem at a time (SPEC §5.1). */
export function Assignment({ seed, numbers, child, onFinish, onLeave }: Props) {
  const problems = useMemo(() => generateAssignment(seed), [seed])
  // Frozen when the assignment opens, so a background sync can't change the top bar mid-assignment.
  const [shownNumbers] = useState(() => numbers)
  const [shownChild] = useState(() => child)
  const [index, setIndex] = useState(0)
  const [typed, setTyped] = useState('')
  const [correct, setCorrect] = useState(0)
  const [answers, setAnswers] = useState<number[]>([])
  const [response, setResponse] = useState<'correct' | 'shown' | null>(null)

  const problem = problems[index]
  const last = index === problems.length - 1
  const entry = entryFor(problem.operation)
  const boxes = boxCount(problem)

  const check = () => {
    const answer = answerValue(typed, entry)
    const right = checkAnswer(problem, answer)
    setAnswers((a) => [...a, answer])
    if (right) setCorrect((c) => c + 1)
    setResponse(right ? 'correct' : 'shown')
  }
  const next = () => {
    if (response === null) return
    if (last) return onFinish(answers, correct)
    setIndex((i) => i + 1)
    setTyped('')
    setResponse(null)
  }

  const lead = response === 'correct' ? COPY.cheers[index % COPY.cheers.length] : COPY.showHow
  const after = response === 'shown' ? (last ? COPY.lastOne : COPY.keepGoing) : null

  return (
    <PracticeFrame
      numbers={shownNumbers}
      child={shownChild}
      subject={COPY.subjectMath}
      title={COPY.mathTitle}
      progress={{
        label: COPY.progress(index + 1, problems.length),
        done: index + 1,
        total: problems.length,
      }}
      backLabel={COPY.leave}
      // All 20 answered counts as finished, even if she leaves before tapping "See how I did".
      onBack={() =>
        answers.length === problems.length ? onFinish(answers, correct) : onLeave(answers, correct)
      }
      note={COPY.mathNote}
      actions={
        // A new button for each step, so focus moves to Next after Check (it is one tap or swipe away).
        response ? (
          <NextButton key="next" label={last ? COPY.seeResult : COPY.next} onClick={next} />
        ) : (
          <Button key="check" variant="action" disabled={typed === ''} onClick={check}>
            {COPY.check}
            <CheckIcon />
          </Button>
        )
      }
    >
      <section className="practice-panel practice-panel-problem">
        <div className="practice-instructions">
          <p className="practice-eyebrow">{COPY.mathEyebrow(problem.operation)}</p>
          <p className="practice-instruction">{COPY.mathInstruction(problem.operation)}</p>
        </div>
        <div className="practice-stage">
          <StackedProblem
            problem={problem}
            boxes={boxes}
            // Her answer stays exactly as she typed it; the right answer is only in the line above Next.
            shown={shownDigits(typed, entry)}
            next={response ? null : nextBox(typed, entry, boxes)}
            outcome={response === null ? null : response === 'correct' ? 'right' : 'notRight'}
          />
        </div>
        {/* Always mounted, so VoiceOver announces each response as its text changes. */}
        <p className="visually-hidden" aria-live="polite">
          {response && [lead, formatEquation(problem), after].filter(Boolean).join(' ')}
        </p>
      </section>
      <section className="practice-panel practice-panel-warm">
        {response === null ? (
          <>
            <p className="practice-pad-heading">{COPY.padHeading}</p>
            <NumberPad
              practice
              onDigit={(d) => setTyped((t) => typeDigit(t, d, boxes))}
              onDelete={() => setTyped(deleteDigit)}
            />
          </>
        ) : (
          <div className="response">
            <p className="response-lead">{lead}</p>
            <p className="response-equation">{formatEquation(problem)}</p>
            {after && <p className="response-after">{after}</p>}
          </div>
        )}
      </section>
    </PracticeFrame>
  )
}
