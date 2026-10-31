import { useId, type ComponentProps } from 'react'

interface CommonProps {
  label: string
  hint?: string
  /** A word shown after the box, inside the same row (the price's "Macaronis"). */
  unit?: string
}

type InputProps = CommonProps & Omit<ComponentProps<'input'>, 'id' | 'className'> & { multiline?: false }
type AreaProps = CommonProps & Omit<ComponentProps<'textarea'>, 'id' | 'className'> & { multiline: true }

/**
 * The one text box, with its label and an optional hint. Parent pages only: her screens never use one.
 * `multiline` makes it a taller textarea (the Macaronis reason).
 */
export function TextField(props: InputProps | AreaProps) {
  const id = useId()
  const { label, hint, unit, multiline, ...rest } = props
  const input = multiline ? (
    <textarea id={id} className="text-field-input" rows={3} {...(rest as ComponentProps<'textarea'>)} />
  ) : (
    <input id={id} className="text-field-input" {...(rest as ComponentProps<'input'>)} />
  )
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
