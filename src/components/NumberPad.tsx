import { useEffect, useState } from 'react'
import { COPY } from '../copy'
import { Button } from '../ui/Button'

/**
 * The pad appears where the Next button just was. Ignoring taps this long after it appears keeps a
 * double tap on Next from typing a digit into the next problem.
 */
const READY_AFTER_MS = 350

interface Props {
  onDigit: (digit: number) => void
  onDelete: () => void
  onCheck: () => void
  canCheck: boolean
}

/** The on-screen number pad (SPEC §5.1): the iPad keyboard never opens. */
export function NumberPad({ onDigit, onDelete, onCheck, canCheck }: Props) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), READY_AFTER_MS)
    return () => clearTimeout(timer)
  }, [])
  const whenReady = (action: () => void) => () => {
    if (ready) action()
  }

  return (
    <div className="pad" data-ready={ready || undefined}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
        // The first key takes focus, so VoiceOver lands on the pad for each new problem.
        <Button key={d} variant="key" autoFocus={d === 1} onClick={whenReady(() => onDigit(d))}>
          {d}
        </Button>
      ))}
      <Button variant="key" aria-label={COPY.delete} onClick={whenReady(onDelete)}>
        {COPY.deleteKey}
      </Button>
      <Button variant="key" onClick={whenReady(() => onDigit(0))}>
        0
      </Button>
      <Button variant="check" disabled={!canCheck} onClick={whenReady(onCheck)}>
        {COPY.check}
      </Button>
    </div>
  )
}
