import { COPY } from '../../copy'
import { Button } from '../../ui/Button'

interface Props {
  /** True when the sign-in has run out: reloading signs in again, so there is no Try again. */
  signedOut: boolean
  onRetry: () => void
}

/** What every screen shows when the children can't be listed (SPEC §5.3): no forms, no switcher. */
export function ChildrenGate({ signedOut, onRetry }: Props) {
  return (
    <section className="parent-section" role="alert">
      <p>{signedOut ? COPY.parentSignedOut : COPY.parentChildrenUnavailable}</p>
      {!signedOut && <Button onClick={onRetry}>{COPY.parentTryAgain}</Button>}
    </section>
  )
}
