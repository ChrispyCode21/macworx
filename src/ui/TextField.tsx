import { useId, type ComponentProps } from 'react'

interface Props extends Omit<ComponentProps<'input'>, 'id' | 'className'> {
  label: string
  hint?: string
  /** A word shown after the box, inside the same row (the price's "Macaronis"). */
  unit?: string
}

/** The one text box, with its label and an optional hint. Parent pages only: her screens never use one. */
export function TextField({ label, hint, unit, ...props }: Props) {
  const id = useId()
  const input = <input id={id} className="text-field-input" {...props} />
  return (
    <label className="text-field" htmlFor={id}>
      <span className="text-field-label">{label}</span>
      {unit ? (
        <span className="text-field-row">
          {input}
          <span className="text-field-unit">{unit}</span>
        </span>
      ) : (
        input
      )}
      {hint && <span className="text-field-hint">{hint}</span>}
    </label>
  )
}
