import { COPY, GRADE_COPY } from '../copy'
import { ASSIGNMENT_SIZE, grade, leftEarlyPayout, type Payout } from '../engine'
import { Button } from '../ui/Button'

type FinishedOutcome = { kind: 'finished'; correct: number; problemCount: number; earned: Payout }

/** How an assignment went: finished, or left early (SPEC §5.1, §6.4, §6.6). */
export type Outcome = FinishedOutcome | { kind: 'leftEarly'; answered: number; correct: number }

interface Props {
  outcome: Outcome
  onAnother: () => void
  onHome: () => void
}

export function Result({ outcome, onAnother, onHome }: Props) {
  return (
    <main className="screen result">
      {outcome.kind === 'finished' ? <Finished {...outcome} /> : <LeftEarly {...outcome} />}
      <div className="result-buttons">
        <Button onClick={onAnother}>{COPY.anotherOne}</Button>
        <Button variant="secondary" onClick={onHome}>
          {COPY.home}
        </Button>
      </div>
    </main>
  )
}

function Finished({ correct, problemCount, earned }: FinishedOutcome) {
  const { heading, line } = GRADE_COPY[grade(correct, problemCount)]
  return (
    <>
      <h1>{heading}</h1>
      <p>{line}</p>
      <p className="result-count">{COPY.rightCount(correct, problemCount)}</p>
      <p className="result-macaronis">
        {earned.accuracyBonus + earned.streakBonus > 0 &&
          COPY.bonus(earned.base, earned.accuracyBonus, earned.streakBonus)}
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
