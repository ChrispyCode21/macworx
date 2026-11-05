/** Whether this iPad can speak: the Web Speech API's speech synthesis (SPEC §5.5 step 4). */
export function canSpeak(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  )
}

/**
 * Says `text` aloud, in English at a slow pace (docs/DESIGN-PRACTICE.md §10). Anything still being said stops
 * first, so a second tap stops and plays again. Call it straight from a tap: iOS only speaks after one.
 */
export function speak(text: string): void {
  if (!canSpeak()) return
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'en-US'
  utterance.rate = 0.8
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}

/** Stops anything being said. */
export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel()
}
