import { ArrowRightIcon } from '../../practice/icons'
import { Button } from '../../ui/Button'
import { READY_AFTER_MS, useReadyAfter, whenReady } from '../../ui/useReadyAfter'

/**
 * Next sits where Check just was. For a moment after it appears it ignores taps, so a double tap on Check
 * can't also skip her result (SPEC §5.1 step 4). Mounted fresh after Check, so it takes focus.
 */
export function NextButton({ label, onClick }: { label: string; onClick: () => void }) {
  const ready = useReadyAfter(READY_AFTER_MS)
  return (
    <Button autoFocus variant="action" data-ready={ready || undefined} onClick={whenReady(ready, onClick)}>
      {label}
      <ArrowRightIcon />
    </Button>
  )
}
