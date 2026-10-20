/** The pairing code's six boxes, filled left to right. Same look as the answer boxes (index.css). */
export function CodeBoxes({ typed, length }: { typed: string; length: number }) {
  return (
    <div className="code-boxes" role="img" aria-label={typed.split('').join(' ')} data-typed={typed}>
      {Array.from({ length }, (_, i) => (
        <span key={i} className={i === typed.length ? 'answer-box answer-box-next' : 'answer-box'}>
          {typed[i] ?? ''}
        </span>
      ))}
    </div>
  )
}
