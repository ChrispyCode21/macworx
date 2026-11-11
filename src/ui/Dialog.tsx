import { useEffect, useId, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import { Button } from './Button'

interface Props {
  open: boolean
  title: string
  closeLabel: string
  onClose: () => void
  /** Where focus goes on closing, for a browser (Safari) that doesn't focus a button when it is tapped. */
  returnFocusTo?: RefObject<HTMLElement | null>
  children: ReactNode
}

/**
 * A modal dialog over the browser's own `<dialog>` (Safari has it from iPadOS 15.4): it traps focus, Escape closes
 * it, and what has focus when it opens gets it back when it closes. Parent pages only. The children are mounted
 * only while it is open, so what they read is read when it opens.
 */
export function Dialog({ open, title, closeLabel, onClose, returnFocusTo, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const titleId = useId()

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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
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
