/** Whether this iPad can speak: the Web Speech API's speech synthesis (SPEC §5.7 step 2). */
export function canSpeak(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  )
}

/**
 * Says the word, then its sentence when it has one, as one go: anything still being said stops once, and both are
 * queued (two `speak()` calls would cut the word off). Call it straight from a tap.
 */
export function speakWord(word: string, sentence: string): void {
  if (!canSpeak()) return
  window.speechSynthesis.cancel()
  for (const text of sentence ? [word, sentence] : [word]) {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 0.8
    window.speechSynthesis.speak(utterance)
  }
}

/** Stops anything being said. */
export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel()
}
