import { useMemo, useState } from 'react'
import { deleteDigit, typeDigit } from '../assignment/answer'
import { NumberPad } from '../components/NumberPad'
import { StackedProblem } from '../components/StackedProblem'
import { COPY } from '../copy'
import { checkAnswer, generateAssignment } from '../engine'
import { Button } from '../ui/Button'
import { formatEquation } from '../ui/format'

interface Props {
  seed: number
  onFinish: (correct: number, problemCount: number) => void
  onLeave: (answered: number, correct: number) => void
}

/** One assignment, a problem at a time (SPEC §5.1). */
export function Assignment({ seed, onFinish, onLeave }: Props) {
  const problems = useMemo(() => generateAssignment(seed), [seed])
  const [index, setIndex] = useState(0)
  const [typed, setTyped] = useState('')
  const [correct, setCorrect] = useState(0)
  const [response, setResponse] = useState<'correct' | 'shown' | null>(null)

  const problem = problems[index]
  const last = index === problems.length - 1
  const answered = index + (response ? 1 : 0)

  const check = () => {
    const right = checkAnswer(problem, Number(typed))
    if (right) setCorrect((c) => c + 1)
    setResponse(right ? 'correct' : 'shown')
  }
  const next = () => {
    if (last) return onFinish(correct, problems.length)
    setIndex((i) => i + 1)
    setTyped('')
    setResponse(null)
  }

  const lead = response === 'correct' ? COPY.cheers[index % COPY.cheers.length] : COPY.showHow
  const after = response === 'shown' ? (last ? COPY.lastOne : COPY.keepGoing) : null

  return (
    <main className="screen assignment">
      <header className="assignment-bar">
        <span>{COPY.progress(index + 1, problems.length)}</span>
        <Button
          variant="secondary"
          // All 20 answered counts as finished, even if she leaves before tapping "See how I did".
          onClick={() =>
            answered === problems.length ? onFinish(correct, answered) : onLeave(answered, correct)
          }
        >
          {COPY.leave}
        </Button>
      </header>
      <StackedProblem problem={problem} answer={response ? String(problem.answer) : typed} />
      {/* Always mounted, so VoiceOver announces each response as its text changes. */}
      <p className="visually-hidden" aria-live="polite">
        {response && [lead, formatEquation(problem), after].filter(Boolean).join(' ')}
      </p>
      {response === null ? (
        <NumberPad
          onDigit={(d) => setTyped((t) => typeDigit(t, d))}
          onDelete={() => setTyped(deleteDigit)}
          onCheck={check}
          canCheck={typed !== ''}
        />
      ) : (
        <section className="response">
          <p className="response-lead">{lead}</p>
          <p className="response-equation">{formatEquation(problem)}</p>
          {after && <p>{after}</p>}
          {/* Focus moves here, so the next step is one tap (or one swipe) away. */}
          <Button autoFocus onClick={next}>
            {last ? COPY.seeResult : COPY.next}
          </Button>
        </section>
      )}
    </main>
  )
}
