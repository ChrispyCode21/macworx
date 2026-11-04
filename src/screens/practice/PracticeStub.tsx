import { COPY } from '../../copy'
import type { HomeNumbers, PracticeChild } from '../../sync/projection'
import { PracticeFrame } from './PracticeFrame'

interface Props {
  subject: 'spelling' | 'reading'
  numbers?: HomeNumbers
  child?: PracticeChild | null
  onBack: () => void
}

/** Spelling and Reading until their samples are built: the practice frame with its crumb and title, nothing else. */
export function PracticeStub({ subject, numbers, child, onBack }: Props) {
  const spelling = subject === 'spelling'
  return (
    <PracticeFrame
      numbers={numbers}
      child={child}
      subject={spelling ? COPY.subjectSpelling : COPY.subjectReading}
      title={spelling ? COPY.spellingTitle : COPY.readingTitle}
      onBack={onBack}
      backLabel={COPY.back}
      actions={null}
    >
      {null}
    </PracticeFrame>
  )
}
