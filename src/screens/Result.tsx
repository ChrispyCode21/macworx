import { COPY, GRADE_COPY } from '../copy'
import { ASSIGNMENT_SIZE, grade, leftEarlyPayout, payout } from '../engine'
import { Button } from '../ui/Button'

/** How an assignment went: finished, or left early (SPEC §5.1, §6.4, §6.6). */
export type Outcome =
  | { kind: 'finished'; correct: number; problemCount: number }
  | { kind: 'leftEarly'; answered: number; correct: number }

interface Props {
  outcome: Outcome
  onAnother: () => void
  onHome: () => void
}

export function Result({ outcome, onAnother, onHome }: Props) {
  return (
    <main className="screen result">
      {outcome.kind === 'finished' ? <Finished {...outcome} /> : <LeftEarly {...outcome} />}
      <p className="note">{COPY.savingSoon}</p>
      <div className="result-buttons">
        <Button onClick={onAnother}>{COPY.anotherOne}</Button>
        <Button variant="secondary" onClick={onHome}>
          {COPY.home}
        </Button>
      </div>
    </main>
  )
}

function Finished({ correct, problemCount }: { correct: number; problemCount: number }) {
  // Nothing is saved yet, so there's no streak: the streak bonus waits for the saving slice.
  const earned = payout({ correct, problemCount, firstOfDay: false, streak: 0 })
  const { heading, line } = GRADE_COPY[grade(correct, problemCount)]
  return (
    <>
      <h1>{heading}</h1>
      <p>{line}</p>
      <p className="result-count">{COPY.rightCount(correct, problemCount)}</p>
      <p className="result-macaronis">
        {earned.accuracyBonus > 0 && COPY.bonus(earned.base, earned.accuracyBonus)}
        <strong>{COPY.macaronis(earned.total)}</strong>
      </p>
    </>
  )
}

function LeftEarly({ answered, correct }: { answered: number; correct: number }) {
  const earned = leftEarlyPayout({ correct, answered, problemCount: ASSIGNMENT_SIZE })
  return (
    <>
      <h1>{COPY.didProblems(answered)}</h1>
      {earned.total > 0 && (
        <p className="result-macaronis">
          <strong>{COPY.macaronis(earned.total)}</strong>
        </p>
      )}
    </>
  )
}
