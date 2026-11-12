import { useId, useRef, useState } from 'react'
import type { DragEvent } from 'react'

interface Props {
  label: string
  /** The line inside the box, e.g. "Upload or drag and drop". */
  prompt: string
  hint?: string
  /** File types the picker offers (`accept`); the caller still checks what it is given. */
  accept: string
  disabled?: boolean
  onFile: (file: File) => void
}

/**
 * The one file box for parent pages: a labelled box that opens the file picker when used and takes a file dropped on
 * it. It hands the caller one file and checks nothing about it. The input inside is the real control, so the keyboard
 * and screen readers use it as any file input.
 */
export function FileDrop({ label, prompt, hint, accept, disabled, onFile }: Props) {
  const id = useId()
  const hintId = `${id}-hint`
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const drop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault()
    setOver(false)
    const file = event.dataTransfer.files[0]
    if (file && !disabled) onFile(file)
  }

  return (
    <div className="text-field file-drop-field">
      <span className="text-field-label">{label}</span>
      <label
        className={`file-drop${over ? ' file-drop-over' : ''}${disabled ? ' file-drop-disabled' : ''}`}
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={drop}
      >
        <input
          ref={input}
          id={id}
          className="file-drop-input"
          type="file"
          accept={accept}
          disabled={disabled}
          aria-describedby={hint ? hintId : undefined}
          onChange={(e) => {
            const file = e.target.files?.[0]
            // The same file can be chosen again after Remove.
            e.target.value = ''
            if (file) onFile(file)
          }}
        />
        <span className="file-drop-prompt">{prompt}</span>
      </label>
      {hint && (
        <span id={hintId} className="text-field-hint">
          {hint}
        </span>
      )}
    </div>
  )
}
