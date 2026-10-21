import { COPY } from '../copy'
import type { HomeNumbers } from '../sync/projection'
import { Button } from '../ui/Button'

interface Props {
  onStart: () => void
  /** Set only while this installed iPad isn't paired (SPEC §5.4). */
  onPair?: () => void
  /** Start found no seeds and no connection (SPEC §6.8). */
  noSeeds?: boolean
  /** Her four numbers; absent until a paired iPad has the Worker's state (SPEC §6.8). */
  numbers?: HomeNumbers
}

export function Home({ onStart, onPair, noSeeds, numbers }: Props) {
  return (
    <main className="screen home">
      <h1>{COPY.title}</h1>
      {numbers && (
        <ul className="home-numbers">
          <li>{COPY.macaronis(numbers.balance)}</li>
          <li>{COPY.completedCount(numbers.completed)}</li>
          {numbers.streak !== null && <li>{COPY.streakDays(numbers.streak)}</li>}
          {numbers.latestGrade !== null && <li>{COPY.latestGrade(numbers.latestGrade)}</li>}
        </ul>
      )}
      <Button onClick={onStart}>{COPY.start}</Button>
      <p>{noSeeds ? COPY.connectForProblems : COPY.startHint}</p>
      {onPair && (
        <Button variant="secondary" onClick={onPair}>
          {COPY.pairThisIpad}
        </Button>
      )}
    </main>
  )
}
