import type { KeyboardEvent } from 'react'
import { Button } from './Button'

interface Props<T extends string> {
  /** What the group is for, read out with it. */
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  /** Shows the choice but does not let it change (the Review step). */
  disabled?: boolean
}

/**
 * A choice of one from a few, in the portal's Add / Remove look (docs/DESIGN.md §7): a radio group whose
 * selected option is the primary button. Arrow keys move the choice.
 */
export function Segmented<T extends string>({ label, options, value, onChange, disabled }: Props<T>) {
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const step =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0
    if (step === 0) return
    e.preventDefault()
    const at = options.findIndex((o) => o.value === value)
    const next = options[(at + step + options.length) % options.length]
    onChange(next.value)
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`)?.focus()
  }
  return (
    <div className="parent-choice" role="radiogroup" aria-label={label} onKeyDown={onKey}>
      {options.map((o) => (
        <Button
          key={o.value}
          variant={o.value === value ? 'primary' : 'secondary'}
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          data-value={o.value}
          disabled={disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </Button>
      ))}
    </div>
  )
}
