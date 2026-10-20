import { COPY } from '../copy'
import { Button } from '../ui/Button'

interface Props {
  onStart: () => void
  /** Set only while this installed iPad isn't paired (SPEC §5.4). */
  onPair?: () => void
  /** Start found no seeds and no connection (SPEC §6.8). */
  noSeeds?: boolean
}

export function Home({ onStart, onPair, noSeeds }: Props) {
  return (
    <main className="screen home">
      <h1>{COPY.title}</h1>
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
