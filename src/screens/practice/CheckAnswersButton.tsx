import { COPY } from '../../copy'
import { CheckIcon } from '../../practice/icons'
import { Button } from '../../ui/Button'
import { READY_AFTER_MS, useReadyAfter, whenReady } from '../../ui/useReadyAfter'

/**
 * Check answers sits where the passage's Next just was. For a moment after the questions open it ignores taps,
 * so a double tap on Next can't also check her answers (SPEC §5.1 step 4).
 */
export function CheckAnswersButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  const ready = useReadyAfter(READY_AFTER_MS)
  return (
    <Button
      variant="action"
      disabled={disabled}
      data-ready={ready || undefined}
      onClick={whenReady(ready, onClick)}
    >
      {COPY.checkAnswers}
      <CheckIcon />
    </Button>
  )
}
