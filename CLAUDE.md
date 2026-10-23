# CLAUDE.md

Standing instructions for every Claude session in this repo. Every run reads this whole file, so it stays short: rules live here, detail lives in the files below.

## Read first

- **SPEC.md**: what the app does and why. The source of truth.
- **ARCHITECTURE.md**: folder map, data flow, D1 schema, hosting. Created with the first code.
- **PIPELINE.md**: which model plans, builds and reviews. Read it only when deciding who reviews a PR or when changing the pipeline.

## Source of truth

- Build to SPEC.md. If it doesn't cover a behavior, stop and ask the owner, with a recommended default. Never guess and move on.
- Open questions are GitHub issues labeled `question`, never notes in the docs.
- When the owner decides something, update SPEC.md in the same PR. SPEC.md is written in the present tense, with no history.

## Stack

- React + TypeScript, built with Vite. vite-plugin-pwa for install and offline use (iPad, installed from Safari).
- Cloudflare Workers: static assets plus an `/api/*` Worker. D1 database. Schema changes are numbered SQL migrations in `migrations/`.
- Vitest, oxlint, Prettier, Playwright (WebKit and Chromium, iPad viewports).

## Architecture rules

- **The question engine is pure TypeScript** in `src/engine/`. It generates problems, scores answers, and calculates Macaronis and grades. No React, no `fetch`, no D1. A lint rule fails any engine import from outside `src/engine/`.
- **The Worker re-scores every result** with the same engine. The client never decides what it earned.
- **Payout values and grade cutoffs live in one config module**, never as scattered constants.
- **Never-negative wording.** No text frames a result as failure. Grades are Excellent, Great, Good and Improving.
- **Parent routes** (`/parent`, `/api/parent/*`) sit behind Cloudflare Access. Never add an unauthenticated write endpoint.
- **The one exception** is `POST /api/pair`, which has no key or token and is not behind Access. It stays gated by a 6-digit code a parent makes behind Access that lasts 10 minutes, works once and allows 5 tries (SPEC §6.9). Never loosen those guards or add another such route. The only addition is the preview code (SPEC §6.9): a secret that works only on a PR preview (preview mark, no Access settings), so it does nothing on production.

## Tests

- Every worked example in SPEC.md (the payout table, the grade cutoffs) is a unit test named with its ID. CI fails if an ID has no test.
- If a test and the spec disagree, the spec wins. If the spec looks wrong, stop and ask.

## Pull requests

- `main` is protected. Work on a branch, push it, and open a PR with the template.
- **One slice per PR:** one issue, one behavior.
- **Size:** aim for 300 changed lines or fewer, not counting tests, lockfiles and generated files. Over 500, split it before asking for review.
- Tests ship in the same PR as the code they cover.
- Run `npm run check:all` before pushing. Never push red and wait for CI to find it.
- No drive-by refactors. Add them to the cleanup issue instead.
- User-facing changes go in CHANGELOG.md under "Unreleased".

## Building a slice

1. Settle any behavior SPEC.md leaves open, with the owner.
2. Commit the SPEC.md change before any code.
3. Engine logic and its tests.
4. Worker and D1: a migration and its test.
5. UI on top.
6. Docs in the same PR: ARCHITECTURE.md, CHANGELOG.md, SPEC.md.

## Keeping token use lean

- Read only the files the task touches. Find them with grep or glob instead of reading whole folders.
- Read the relevant range of a long file or log, not all of it.
- While working, run only the affected test file. Run `check:all` once, before pushing.
- If a rule can be a lint rule, test or script, make it one. A failing check costs nothing; a model review costs tokens every time.
