import { COPY } from '../../copy'
import { Button } from '../../ui/Button'
import { Panel } from '../../ui/Panel'

interface Props {
  /** True when the sign-in has run out: reloading signs in again, so there is no Try again. */
  signedOut: boolean
  /** True while Try again reads the children again. */
  retrying: boolean
  onRetry: () => void
}

/** What every screen shows when the children can't be listed (SPEC §5.3): no forms, no switcher. */
export function ChildrenGate({ signedOut, retrying, onRetry }: Props) {
  return (
    <Panel>
      <p role="alert">
        {signedOut ? COPY.parentSignedOut : retrying ? COPY.parentLoading : COPY.parentChildrenUnavailable}
      </p>
      {!signedOut && (
        <Button aria-disabled={retrying} onClick={onRetry}>
          {COPY.parentTryAgain}
        </Button>
      )}
    </Panel>
  )
}
