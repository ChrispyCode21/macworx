import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { COPY } from '../copy'
import { ArrowRightIcon } from '../parent/icons'
import { Button } from './Button'

/**
 * The parent portal's "Review, then Confirm" step (docs/DESIGN.md §7). Shows the Review button; while
 * `reviewing`, shows the confirm panel instead: the change restated (`children`), then Confirm and Back.
 * Review, Confirm and Back replace one another, so focus follows to the button now shown, only on a change
 * of step and never on first mount.
 */
type Props = {
  reviewing: boolean
  review: { label: string; onClick: () => void; disabled?: boolean }
  confirm: { onConfirm: () => void; onBack: () => void; saving: boolean }
  heading?: string
  children: ReactNode
}

export function ReviewStep({ reviewing, review, confirm, heading, children }: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const reviewRef = useRef<HTMLButtonElement>(null)
  const was = useRef(reviewing)
  useEffect(() => {
    if (was.current === reviewing) return
    was.current = reviewing
    ;(reviewing ? confirmRef : reviewRef).current?.focus()
  }, [reviewing])

  if (!reviewing)
    return (
      <Button ref={reviewRef} onClick={review.onClick} disabled={review.disabled}>
        {review.label}
        <ArrowRightIcon size={18} />
      </Button>
    )
  return (
    <div className="parent-review">
      {heading && <h3>{heading}</h3>}
      {children}
      <Button ref={confirmRef} onClick={confirm.onConfirm} disabled={confirm.saving}>
        {COPY.parentConfirm}
      </Button>
      <Button variant="soft" onClick={confirm.onBack} disabled={confirm.saving}>
        {COPY.parentBack}
      </Button>
    </div>
  )
}
