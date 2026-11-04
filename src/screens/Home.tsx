import { COPY } from '../copy'
import type { HomeNumbers } from '../sync/projection'
import { Button } from '../ui/Button'

interface Props {
  onStart: () => void
  /** Spelling and Reading open their practice screens, on any iPad (SPEC §5.5). */
  onOpen: (subject: 'spelling' | 'reading') => void
  /** Set only while this installed iPad isn't paired (SPEC §5.4). */
  onPair?: () => void
  /** Start found no seeds and no connection (SPEC §6.8). */
  noSeeds?: boolean
  /** Her four numbers; absent until a paired iPad has the Worker's state (SPEC §6.8). */
  numbers?: HomeNumbers
}

export function Home({ onStart, onOpen, onPair, noSeeds, numbers }: Props) {
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
      <div className="home-subjects">
        <Button onClick={onStart}>{COPY.subjectMath}</Button>
        <Button onClick={() => onOpen('spelling')}>{COPY.subjectSpelling}</Button>
        <Button onClick={() => onOpen('reading')}>{COPY.subjectReading}</Button>
      </div>
      <p>{noSeeds ? COPY.connectForProblems : COPY.startHint}</p>
      {onPair && (
        <Button variant="secondary" onClick={onPair}>
          {COPY.pairThisIpad}
        </Button>
      )}
      {/* A plain link, so it is a full page load and Cloudflare Access can ask for a sign-in (SPEC §5.3). */}
      <a className="home-parents" href="/parent/overview">
        {COPY.parentsLink}
      </a>
    </main>
  )
}
