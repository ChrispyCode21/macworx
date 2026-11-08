import type { ReactNode } from 'react'
import { PracticePanel } from '../../ui/PracticePanel'

/** The panel shown when a sample is finished (docs/DESIGN-PRACTICE.md §10, §11): one centred line. */
export function PracticeDone({ children }: { children: ReactNode }) {
  return (
    <PracticePanel className="practice-done">
      <p className="practice-done-title">{children}</p>
    </PracticePanel>
  )
}
