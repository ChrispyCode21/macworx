# Architecture

How macworx is built. SPEC.md says what it does; this file covers only what exists in the code.

## Folder map

| Path | What it holds |
|---|---|
| `src/` | The React app (Vite). `main.tsx` mounts `App.tsx`, which switches between screens. See "UI". |
| `src/screens/` | One component per screen: Home, Assignment, Result. |
| `src/components/` | Pieces of a screen: `NumberPad`, `StackedProblem`. |
| `src/ui/` | Shared building blocks: `Button` and `format.ts`. |
| `src/assignment/` | Pure helpers for the assignment screen: answer boxes and number pad typing. |
| `src/engine/` | The question engine, pure TypeScript (CLAUDE.md). See "Question engine". |
| `worker/` | The Cloudflare Worker that answers `/api/*`: routing (`index.ts`), device keys (`auth.ts`), the child API (`child.ts`). `worker/test/` holds a local D1 for its tests. |
| `migrations/` | Numbered D1 SQL migrations, applied in order. See "Data". |
| `public/` | Icons, `logo.svg` and `_headers`, copied into the build as is. |
| `e2e/` | Playwright tests of the production build. |
| `scripts/` | The check scripts CI runs, the engine purity test, and `create-device.mjs`. |
| `.github/` | CI, security and release workflows, the `main` ruleset, Dependabot, PR and issue templates. |
| `.claude/agents/` | Local `plan-reviewer` and `code-reviewer` subagents (PIPELINE.md). |

## Question engine

`src/engine/` holds every rule that decides what she earns, so the app and the Worker compute the same results. `index.ts` is its public API (SPEC §8). The app imports only from it.

| File | What it does |
|---|---|
| `config.ts` | The one config module: payout values, grade cutoffs, assignment shape, number ranges and reward prices. |
| `random.ts` | A seeded generator (mulberry32). |
| `problems.ts` | `generateAssignment(seed)`: 20 shuffled problems; the same seed always gives the same assignment, so the Worker can regenerate and re-score it. `makeProblem` computes an answer. |
| `score.ts` | `checkAnswer`: a whole number equal to the computed answer. |
| `streak.ts` | `nextStreak(state, today)`: dates come in as `YYYY-MM-DD` strings and are compared as day numbers, with no `Date` object or clock. |
| `payout.ts` | `payout`: base, accuracy bonus, streak bonus and total, all whole-number math. |
| `grade.ts` | `grade`: the grade from the cutoffs in `config.ts`. |

Each file's tests sit beside it, named with their SPEC §7 IDs.

## UI

- **Screens:** `App.tsx` holds which screen is showing (home, an assignment with its seed, or a result) in React state. There's no router, and nothing is saved yet: a result lives only until the next screen.
- **Seeds:** each assignment gets a random seed from `crypto.getRandomValues` in `App.tsx`. The engine never makes randomness itself.
- **Text:** every string she sees lives in `src/copy.ts`, including the grade headings, keyed by the engine's `Grade` type.
- **Shared building blocks:** `src/ui/Button` is the only button, with variants `primary`, `secondary`, `key` and `check`. `src/ui/format.ts` does all number and operator formatting. Colors and sizes are CSS custom properties at the top of `src/index.css`. `check-conventions` fails on a raw `<button>` or inline number formatting outside `src/ui/`, on words written straight into JSX instead of `src/copy.ts`, and on a hex color outside the tokens.
- **Answer boxes:** `StackedProblem` lays the problem out one digit per column with one answer box per column. `src/assignment/answer.ts` keeps her digits in the order she tapped them, and derives the boxes from them: ones place first for addition and subtraction, left to right (lined up under the ones column) for multiplication.
- **Layout:** the assignment puts the number pad below the problem in portrait and beside it in landscape. Nothing uses an `<input>`, so the iPad keyboard never opens. The pad ignores taps for 350 ms after it appears, so a double tap on Next can't type into the next problem. Padding respects the iPad's safe areas.
- **VoiceOver:** an always-present hidden live region reads each response, and focus moves to Next after Check and to the pad after Next.

## Data flow

- The browser loads the built app (`dist/`) as static assets from Cloudflare Workers. Any unknown path serves `index.html`.
- `/api` and `/api/*` reach the Worker first (`run_worker_first` in `wrangler.jsonc`). `GET /api/health` answers `{ "ok": true }` without a key. Every other route needs a device key (`Authorization: Bearer <key>`) and returns 401 without a valid one; an unknown route returns 404.
- **The child API** (`worker/child.ts`, SPEC §6.8, §8): `GET /api/state`, `POST /api/seeds` and `POST /api/results`. The Worker regenerates each assignment from its seed and re-scores it with the engine, imported straight from `src/engine/`, so the app and the Worker can't disagree on the rules. The app doesn't call it yet (#19).

## Data

D1, one database per environment (see "Hosting"). `migrations/0001_init.sql` creates STRICT tables:

| Table | Holds |
|---|---|
| `devices` | Paired iPads: the SHA-256 of each device key (never the key), a label, and when it was revoked. |
| `seeds` | Seeds handed out, the device and day they went to, and whether a result used them. |
| `results` | Each recorded assignment as the Worker re-scored it: her answers (JSON), counts, grade and payout. |
| `child` | One row: balance, streak, last counted day, completed assignments. A parent restores a broken streak by editing `streak` and `last_day` here, and changes `revision` in the same statement (see below). |

- **One write at a time:** recording a result is one D1 batch. Its first statement updates `child` only if `revision` still has the value read before the write, and sets a new random revision. The result insert and the seed update apply only if the new revision is in place. So a lost race changes nothing; the Worker re-reads and retries (3 tries, then 503), and a repeat of the same seed returns the recorded result.
- **Editing by hand:** `UPDATE child SET streak = 5, last_day = '2026-10-17', revision = lower(hex(randomblob(16))) WHERE id = 1`. Changing `revision` makes a result being recorded at that moment retry from the edited row rather than overwrite it.
- **Seeds and the app:** `POST /api/seeds` returns every seed the Worker still counts as unused, including ones the iPad has used offline but not synced yet. The app must leave out seeds that are in its result queue (#19).
- **Migrations:** add the next numbered file in `migrations/`, never edit an applied one. Workers Builds applies them before each deploy (see "Hosting"). `npx wrangler d1 migrations apply macworx --local` applies them to the local D1 for `npm run worker:dev`.
- **Pairing by hand:** until the pairing screen exists (#17, #18), `node scripts/create-device.mjs --local|--remote "label"` creates a device and prints its key once.
- **Tests** (`worker/*.test.ts`) run the Worker in Node against a real local D1 from Miniflare, with every migration applied. (`@cloudflare/vitest-pool-workers` doesn't support this repo's Vitest version.)

## Offline and install

`vite-plugin-pwa` generates the web app manifest and a service worker that precaches the built app, so the app opens with no connection (checked by `e2e/smoke.spec.ts`). `/api` paths are never served from the app shell. Icons are generated from `public/logo.svg` with `npx pwa-assets-generator` (`pwa-assets.config.ts`).

`public/_headers` sets the security headers for static assets. `vite preview` applies the same headers, minus HSTS, so a local production build runs under the production policy.

## Hosting

- `wrangler.jsonc` configures the Worker, its static assets and the D1 bindings.
- **Workers Builds** (Cloudflare's GitHub integration) builds every push with `npm run build`, applies migrations, then deploys. The build settings live in the Cloudflare dashboard, not in the repo:
  - Deploy command (`main`): `npx wrangler d1 migrations apply macworx --remote && npx wrangler deploy`
  - Non-production branch deploy command: `npx wrangler d1 migrations apply macworx-preview --remote -c wrangler.preview-migrations.jsonc && npx wrangler preview`
- **Two D1 databases, both bound as `DB`:** `macworx` holds production data. `macworx-preview` is used only by preview URLs (the `previews` block), so a PR branch never touches her real data. A branch's migrations run on the shared preview database before it merges.
- `wrangler.preview-migrations.jsonc` exists only so wrangler can find the preview database for migrations; it can't see one that's only in the `previews` block. `worker/config.test.ts` checks the two configs name the same preview database, and that production and previews differ.
- Database IDs identify a database but grant no access, so they're committed. Cloudflare sign-ins and API tokens are never committed, and the build doesn't need any.
- `npm run worker:dev` builds the app and runs the Worker locally against a local D1.

## Quality gates and releases

`npm run check:all` runs every check CI runs, in CI's order. Run it before pushing.

| Check | What it enforces |
|---|---|
| `format:check` | Prettier formatting. |
| `lint` | oxlint. In `src/engine/` it allows only `./` imports (no React, packages or Node modules; engine tests may also import `vitest`) and rejects `fetch`, `globalThis`, the DOM, `Date`, `crypto` and `performance` (`.oxlintrc.json`). |
| `check:conventions` | No `.tsx` files or `Math.random` in the engine; grade labels only in `src/engine/config.ts`; never-negative wording in strings and JSX text under `src/`; no skipped, todo or focused tests; `<Button>`, `src/ui/format.ts`, `src/copy.ts` and color tokens instead of raw buttons, inline formatting, JSX text or hex colors (`scripts/check-conventions.mjs`). |
| `check:spec` | Every SPEC §7 example ID has a test named `it('ID: ...')`, unless it's listed in `scripts/spec-pending.txt`. Commented-out tests don't count. A listed ID that has a test fails too, so the list only shrinks. |
| `check:changelog` | CHANGELOG.md has a section for `package.json`'s version. |
| `test` | Vitest: `src/`, `worker/` and `scripts/` tests. `scripts/engine-purity.test.mjs` proves the engine checks fire. |
| `build` | Type-check (app, Worker, configs, e2e) and production build. |
| `test:e2e` | Playwright, WebKit and Chromium, iPad portrait (820×1180) and landscape (1180×820): the app loads without sideways scrolling, links its manifest, and opens offline. |

CI (`.github/workflows/ci.yml`) runs the same checks as two jobs, **Checks** and **Playwright**. `security.yml` adds CodeQL and dependency review. Dependabot opens weekly grouped updates.

`.github/rulesets/main.json` protects `main`: PRs only, no force-push or deletion, and all the checks above must pass. Apply it once with:

```bash
gh api -X POST repos/ChrispyCode21/macworx/rulesets --input .github/rulesets/main.json
```

Releases: when CI passes on a push to `main` that carries a new `package.json` version, `release.yml` tags that commit and creates a GitHub Release from that version's CHANGELOG.md section.

Milestones are named after versions (`v0.2.0`), and each issue goes in the milestone of the release it's planned for. Releasing a version closes its milestone. Before 1.0, a feature set bumps the middle number and fixes between feature sets bump the last (`v0.1.1`).
