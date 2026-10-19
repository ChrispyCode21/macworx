import { COPY } from '../copy'
import { Button } from '../ui/Button'

/** `onPair` is set only while this installed iPad isn't paired (SPEC §5.4). */
export function Home({ onStart, onPair }: { onStart: () => void; onPair?: () => void }) {
  return (
    <main className="screen home">
      <h1>{COPY.title}</h1>
      <Button onClick={onStart}>{COPY.start}</Button>
      <p>{COPY.startHint}</p>
      {onPair && (
        <Button variant="secondary" onClick={onPair}>
          {COPY.pairThisIpad}
        </Button>
      )}
    </main>
  )
}
