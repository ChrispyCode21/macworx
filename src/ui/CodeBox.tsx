import { useId, useRef } from 'react'

/** The fewest line numbers the gutter shows, so an empty box still reads as one for code. */
const MIN_LINES = 13

interface Props {
  label: string
  hint?: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
}

/**
 * A box for pasted code: a monospace textarea with a line-number gutter that scrolls with it. Parent pages only.
 * Autocorrect, automatic capitals and spell check are off, so pasted JSON arrives as it was.
 */
export function CodeBox({ label, hint, value, placeholder, onChange }: Props) {
  const id = useId()
  const gutter = useRef<HTMLDivElement>(null)
  const lines = Math.max(value.split('\n').length, MIN_LINES)
  return (
    <div className="text-field code-box">
      <label className="text-field-label" htmlFor={id}>
        {label}
      </label>
      {hint && <span className="text-field-hint">{hint}</span>}
      <div className="code-box-frame">
        <div className="code-box-gutter" ref={gutter} aria-hidden="true">
          {Array.from({ length: lines }, (_, i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </div>
        <textarea
          id={id}
          className="code-box-input"
          value={value}
          placeholder={placeholder}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          wrap="off"
          onChange={(e) => onChange(e.target.value)}
          onScroll={(e) => {
            if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop
          }}
        />
      </div>
    </div>
  )
}
