import { COPY } from '../../copy'
import { Button } from '../../ui/Button'
import { READY_AFTER_MS, useReadyAfter, whenReady } from '../../ui/useReadyAfter'

/**
 * Back to Home sits where Finish (or Done) just was. Like Next, it ignores taps for a moment, so a double tap
 * can't also skip the finished panel (SPEC §5.1 step 4). Mounted fresh after it, so it takes focus.
 */
export function BackToHomeButton({ onClick }: { onClick: () => void }) {
  const ready = useReadyAfter(READY_AFTER_MS)
  return (
    <Button autoFocus variant="action" data-ready={ready || undefined} onClick={whenReady(ready, onClick)}>
      {COPY.backToHome}
    </Button>
  )
}
