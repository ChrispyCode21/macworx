import type { ReactNode } from 'react'

/**
 * The line that replaces the footnote after Check on Spelling and Reading (docs/DESIGN-PRACTICE.md §4,
 * "response-line"): a cheer when right, the answer when not. Math has its own, taller response in the pad panel.
 */
export function InlineResponse({ right, children }: { right: boolean; children: ReactNode }) {
  return (
    <div className="response practice-inline-response">
      <p className={right ? 'response-lead' : 'response-equation'}>{children}</p>
    </div>
  )
}
