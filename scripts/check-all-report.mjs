// The text check-all prints for a failing step (scripts/check-all.mjs). Pure, so it can be tested.
// A step that fails to spawn, runs out of output room or is ended by a signal has `status` null and may have
// no `stdout`, so the real reason comes from `error` and `signal` (#44).

/** `run` is what `spawnSync` returned (with `encoding: 'utf8'`). */
export function failureReport(name, run) {
  const output = (run.stdout ?? '').trimEnd()
  const reasons = []
  if (run.error) reasons.push(`Could not run it: ${run.error.message}`)
  if (run.signal) reasons.push(`It was ended by ${run.signal}.`)
  if (!run.error && !run.signal && run.status === null) reasons.push('It did not finish.')
  return `FAIL ${name}\n${[output, ...reasons].filter(Boolean).join('\n')}\n`
}
