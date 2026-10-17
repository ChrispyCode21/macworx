import { COPY } from '../copy'
import { Button } from '../ui/Button'

export function Home({ onStart }: { onStart: () => void }) {
  return (
    <main className="screen home">
      <h1>{COPY.title}</h1>
      <Button onClick={onStart}>{COPY.start}</Button>
      <p>{COPY.startHint}</p>
    </main>
  )
}
