import { COPY } from '../copy'
import { DeleteIcon } from '../practice/icons'
import { Button } from '../ui/Button'
import { useReadyAfter, whenReady } from '../ui/useReadyAfter'

/**
 * The pad mounts fresh with each problem. Ignoring taps this long after it appears keeps a late tap from the
 * problem before from typing a digit into the new one.
 */
const READY_AFTER_MS = 350

interface Props {
  onDigit: (digit: number) => void
  onDelete: () => void
  /** The Check key (the pairing screen's); the practice pad has none, its Check is in the actions row. */
  onCheck?: () => void
  canCheck?: boolean
  /** The Check key's label; the pairing screen calls it Pair. */
  checkLabel?: string
  /** The practice layout (docs/DESIGN-PRACTICE.md §8): no Check key, a delete icon, 0 at the bottom centre. */
  practice?: boolean
}

/** The on-screen number pad (SPEC §5.1): the iPad keyboard never opens. */
export function NumberPad({
  onDigit,
  onDelete,
  onCheck,
  canCheck = false,
  checkLabel = COPY.check,
  practice = false,
}: Props) {
  const ready = useReadyAfter(READY_AFTER_MS)
  const guard = (action: () => void) => whenReady(ready, action)

  return (
    <div className="pad" data-ready={ready || undefined}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
        // The first key takes focus, so VoiceOver lands on the pad for each new problem.
        <Button key={d} variant="key" autoFocus={d === 1} onClick={guard(() => onDigit(d))}>
          {d}
        </Button>
      ))}
      {practice ? (
        <>
          <span />
          <Button variant="key" onClick={guard(() => onDigit(0))}>
            0
          </Button>
          <Button variant="key" aria-label={COPY.delete} onClick={guard(onDelete)}>
            <DeleteIcon />
          </Button>
        </>
      ) : (
        <>
          <Button variant="key" aria-label={COPY.delete} onClick={guard(onDelete)}>
            {COPY.deleteKey}
          </Button>
          <Button variant="key" onClick={guard(() => onDigit(0))}>
            0
          </Button>
          <Button variant="check" disabled={!canCheck} onClick={guard(() => onCheck?.())}>
            {checkLabel}
          </Button>
        </>
      )}
    </div>
  )
}
