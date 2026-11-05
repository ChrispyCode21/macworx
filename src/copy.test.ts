import { describe, expect, it } from 'vitest'
import { COPY } from './copy'

describe('Math screen copy', () => {
  it('labels each operation and says what to do', () => {
    expect(COPY.mathEyebrow('addition')).toBe('Addition practice')
    expect(COPY.mathEyebrow('subtraction')).toBe('Subtraction practice')
    expect(COPY.mathEyebrow('multiplication')).toBe('Multiplication practice')
    expect(COPY.mathInstruction('addition')).toBe('Add the numbers.')
    expect(COPY.mathInstruction('subtraction')).toBe('Subtract the bottom number from the top number.')
    expect(COPY.mathInstruction('multiplication')).toBe('Multiply the numbers.')
    expect(COPY.padHeading).toBe('Tap to enter your answer')
  })
})

describe('Spelling screen copy', () => {
  it('words the listen panel, the choices and the finish', () => {
    expect(COPY.spellingEyebrow).toBe('Listen and spell')
    expect(COPY.playWord).toBe('Play word')
    expect(COPY.playWordSub).toBe('Listen to the word, then choose its spelling.')
    expect(COPY.playUnavailable).toBe("This iPad can't play the word. You can still choose a spelling.")
    expect(COPY.hearSentence).toBe('Hear it in a sentence')
    expect(COPY.spellingChoiceHeading).toBe('Which spelling is right?')
    expect(COPY.spellingChooseOne).toBe('Choose one spelling.')
    expect(COPY.chooseHint).toBe('Choose one')
    expect(COPY.readyToCheck).toBe('Ready to check.')
    expect(COPY.spellingNote).toBe('You can play the word as many times as you need.')
    expect(COPY.finish).toBe('Finish')
    expect(COPY.backToHome).toBe('Back to Home')
  })

  it('names the right spelling, the progress and the finish by count', () => {
    expect(COPY.spellingAnswer('said')).toBe('This word is spelled said.')
    expect(COPY.spellingProgress(1, 8)).toBe('Word 1 of 8')
    expect(COPY.spellingDone(8)).toBe('You finished all 8 words!')
  })
})

describe('Reading screen copy', () => {
  it('words the passage screen', () => {
    expect(COPY.readingProgressRead).toBe('Step 1 of 2 · Read')
    expect(COPY.readingEyebrow('Informational text', 2)).toBe('Informational text · 2 min read')
    expect(COPY.readingGuideTitle).toBe('Read at your own pace.')
    expect(COPY.readingNote(2)).toBe("When you're ready, there are 2 questions about this passage.")
  })

  it('words the questions screen', () => {
    expect(COPY.readingProgressQuestions).toBe('Step 2 of 2 · Questions')
    expect(COPY.questionEyebrow(1, 'Find a detail')).toBe('Question 1 · Find a detail')
    expect(COPY.readingChooseOne).toBe('Choose one answer.')
    expect(COPY.readAgain).toBe('Read again')
    expect(COPY.checkAnswers).toBe('Check answers')
    expect(COPY.done).toBe('Done')
    expect(COPY.readingBestAnswer('A')).toBe('The best answer is A.')
    expect(COPY.readingDone).toBe('You finished the passage and its questions!')
  })

  it('counts the answers chosen, none, one or more', () => {
    expect(COPY.readingChosenNote(0)).toBe('You can read the passage again.')
    expect(COPY.readingChosenNote(1)).toBe('1 answer chosen. You can read the passage again.')
    expect(COPY.readingChosenNote(2)).toBe('2 answers chosen. You can read the passage again.')
  })
})

describe('device sync copy', () => {
  it('words the last-synced line', () => {
    expect(COPY.parentNoResultsYet).toBe('No results yet')
    expect(COPY.parentSyncedToday('4:05 pm')).toBe('Synced today, 4:05 pm')
    expect(COPY.parentSyncedOn('Oct 12')).toBe('Synced Oct 12')
  })
})

describe('old correction log copy', () => {
  it('says Macaroni for one and Macaronis otherwise in the log line', () => {
    expect(COPY.parentLogCorrected('Oct 16', 15, 16, 1, 'x')).toContain('+1 Macaroni:')
    expect(COPY.parentLogCorrected('Oct 16', 16, 15, -1, 'x')).toContain('−1 Macaroni:')
    expect(COPY.parentLogCorrected('Oct 16', 15, 18, 3, 'x')).toContain('+3 Macaronis:')
  })
})

describe('pairing copy', () => {
  it('words the safeguard with the child, balance and streak', () => {
    expect(COPY.parentDisconnectSafe('Mia', 140, 6)).toBe(
      "Removing a device stops it from saving progress for Mia. Mia's synced homework, 140 Macaronis and 6-day streak stay safe.",
    )
    expect(COPY.parentDisconnectSafe('Mia', 1, 0)).toContain('1 Macaroni and 0-day streak')
    expect(COPY.parentDisconnectSafe('Mia', 1234, 1)).toContain('1,234 Macaronis and 1-day streak')
  })

  it('names the device owner, or just the device when no child is known', () => {
    expect(COPY.parentPairBody('Mia')).toBe(
      "Open macworx on Mia's device, then enter the one-time pairing code.",
    )
    expect(COPY.parentPairBody(null)).toBe(
      'Open macworx on the device, then enter the one-time pairing code.',
    )
  })

  it('counts down in minutes', () => {
    expect(COPY.parentCodeExpires(10)).toBe('Expires in 10 minutes.')
    expect(COPY.parentCodeExpires(1)).toBe('Expires in 1 minute.')
  })

  it('calls the thing being paired a device', () => {
    const lines = [
      COPY.pairThisIpad,
      COPY.pairTitle,
      COPY.paired,
      COPY.pairOffline,
      COPY.parentPairTitle,
      COPY.parentPairBody('Mia'),
      COPY.parentNameLabel,
      COPY.parentNameHint,
      COPY.parentMakeCode,
      COPY.parentDisconnectNote,
      COPY.parentAccessBody,
    ]
    for (const line of lines) expect(line).not.toMatch(/ipad/i)
    expect(COPY.pairThisIpad).toBe('Pair this device')
    expect(COPY.paired).toBe('This device is paired!')
  })
})
