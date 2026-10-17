## What and why

<!-- What changed, which issue it closes, and which SPEC.md section it traces to. -->

## Checklist

CI checks formatting, lint (including engine purity), conventions (never-negative wording, grade labels), SPEC §7 test coverage, tests, the build, and the app at iPad sizes (Playwright). These need a human:

- [ ] One slice: one issue, one behavior. Under 300 changed lines (not counting tests, lockfiles and generated files), or split.
- [ ] Builds only to what SPEC.md says; anything it doesn't cover, or that's open as a `question` issue, was asked about first.
- [ ] SPEC.md's text is updated for any decision made.
- [ ] New worked examples in SPEC §7 have tests named with their IDs, and their IDs are off `scripts/spec-pending.txt`.
- [ ] The engine (`src/engine/`) stays pure: no React, `fetch`, D1, clock or `Math.random`.
- [ ] Payout values and grade cutoffs change only in the config module.
- [ ] User-facing changes are in CHANGELOG.md under "Unreleased".
- [ ] Anything Playwright can't check was looked at on the iPad.
