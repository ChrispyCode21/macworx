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
import { ArrowRightIcon, CheckIcon } from '../practice/icons'
import type { HomeNumbers } from '../sync/projection'
import { Button } from '../ui/Button'
import { formatEquation } from '../ui/format'
import { PracticeFrame } from './practice/PracticeFrame'

interface Props {
  seed: number
  /** The numbers Home showed; the top bar keeps them for the whole assignment. */
  numbers?: HomeNumbers
  /** Her answers in order, one per problem she checked. */
  onFinish: (answers: number[], correct: number) => void
  onLeave: (answers: number[], correct: number) => void
}

/** One assignment, a problem at a time (SPEC §5.1). */
export function Assignment({ seed, numbers, onFinish, onLeave }: Props) {
  const problems = useMemo(() => generateAssignment(seed), [seed])
  // Frozen when the assignment opens, so a background sync can't change the top bar mid-assignment.
  const [shownNumbers] = useState(() => numbers)
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
        <Button
          key={response ? 'next' : 'check'}
          variant="action"
          autoFocus={response !== null}
          disabled={response === null && typed === ''}
          onClick={response ? next : check}
        >
          {response ? (last ? COPY.seeResult : COPY.next) : COPY.check}
          {response ? <ArrowRightIcon /> : <CheckIcon />}
        </Button>
      }
    >
      <div className="practice-problem">
        <StackedProblem
          problem={problem}
          boxes={boxes}
          // Her answer stays exactly as she typed it; the right answer is only in the line above Next.
          shown={shownDigits(typed, entry)}
          next={response ? null : nextBox(typed, entry, boxes)}
          outcome={response === null ? null : response === 'correct' ? 'right' : 'notRight'}
        />
        {/* Always mounted, so VoiceOver announces each response as its text changes. */}
        <p className="visually-hidden" aria-live="polite">
          {response && [lead, formatEquation(problem), after].filter(Boolean).join(' ')}
        </p>
      </div>
      {response === null ? (
        <NumberPad
          practice
          onDigit={(d) => setTyped((t) => typeDigit(t, d, boxes))}
          onDelete={() => setTyped(deleteDigit)}
        />
      ) : (
        <section className="response">
          <p className="response-lead">{lead}</p>
          <p className="response-equation">{formatEquation(problem)}</p>
          {after && <p>{after}</p>}
        </section>
      )}
    </PracticeFrame>
  )
}
