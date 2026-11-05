/**
 * Whether the choice she picked is the right one. Both are indexes into the choices, so index 0 is a valid
 * answer. The same check scores a recorded subject on the Worker later (docs/DESIGN-PRACTICE.md §14).
 */
export function checkChoice(chosen: number, answer: number): boolean {
  return Number.isInteger(chosen) && chosen === answer
}
