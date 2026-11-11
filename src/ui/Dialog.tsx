import { useEffect, useId, useRef } from 'react'
import type { MouseEvent, ReactNode, RefObject } from 'react'
import { Button } from './Button'

interface Props {
  open: boolean
  title: string
  closeLabel: string
  onClose: () => void
  /** Where focus goes on closing, for a browser (Safari) that doesn't focus a button when it is tapped. */
  returnFocusTo?: RefObject<HTMLElement | null>
  /** Called when Escape is pressed: answer true to say it ended something inside (an edit), so the dialog stays. */
  onEscape?: () => boolean
  children: ReactNode
}

/**
 * A modal dialog over the browser's own `<dialog>` (Safari has it from iPadOS 15.4): it traps focus, Escape closes
 * it, and what has focus when it opens gets it back when it closes. Parent pages only. The children are mounted
 * only while it is open, so what they read is read when it opens.
 */
export function Dialog({ open, title, closeLabel, onClose, returnFocusTo, onEscape, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const titleId = useId()
  // A click on the backdrop lands on the dialog itself, as one on its padding does: the position tells them apart,
  // and both the press and the release must be outside, so dragging out of a box doesn't close it.
  const pressedOutside = useRef(false)
  const outside = (e: MouseEvent<HTMLDialogElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    return e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom
  }

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      dialog.showModal()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      onClose={() => {
        // Escape, the Close button and the backdrop all end here; the opener has its focus back.
        ;(returnFocusTo?.current ?? opener.current)?.focus()
        opener.current = null
        onClose()
      }}
      onCancel={(e) => {
        if (onEscape?.()) e.preventDefault()
      }}
      onMouseDown={(e) => {
        pressedOutside.current = e.target === e.currentTarget && outside(e)
      }}
      onClick={(e) => {
        if (pressedOutside.current && e.target === e.currentTarget && outside(e)) onClose()
        pressedOutside.current = false
      }}
    >
      <div className="dialog-head">
        <h2 id={titleId} className="parent-heading">
          {title}
        </h2>
        <Button variant="soft" onClick={onClose}>
          {closeLabel}
        </Button>
      </div>
      {open && children}
    </dialog>
  )
}
