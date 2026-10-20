import { useId, type ComponentProps } from 'react'

interface Props extends Omit<ComponentProps<'input'>, 'id' | 'className'> {
  label: string
  hint?: string
}

/** The one text box, with its label and an optional hint. Parent pages only: her screens never use one. */
export function TextField({ label, hint, ...props }: Props) {
  const id = useId()
  return (
    <label className="text-field" htmlFor={id}>
      <span className="text-field-label">{label}</span>
      <input id={id} className="text-field-input" {...props} />
      {hint && <span className="text-field-hint">{hint}</span>}
    </label>
  )
}
