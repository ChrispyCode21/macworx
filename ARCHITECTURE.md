# Architecture

How macworx is built. SPEC.md says what it does; this file covers only what exists in the code.

## Folder map

| Path | What it holds |
|---|---|
| `src/` | The React app (Vite). `main.tsx` mounts `App.tsx`, a placeholder screen. |
| `src/engine/` | The question engine, pure TypeScript (CLAUDE.md). Not created yet. |
| `worker/` | The Cloudflare Worker that answers `/api/*`. |
| `migrations/` | Numbered D1 SQL migrations. Empty: there are no tables yet. |
| `public/` | Icons, `logo.svg` and `_headers`, copied into the build as is. |
| `e2e/` | Playwright tests of the production build. |
| `scripts/` | The check scripts CI runs, plus the engine purity test. |
| `.github/` | CI, security and release workflows, the `main` ruleset, Dependabot, PR and issue templates. |
| `.claude/agents/` | Local `plan-reviewer` and `code-reviewer` subagents (PIPELINE.md). |

## Data flow

- The browser loads the built app (`dist/`) as static assets from Cloudflare Workers. Any unknown path serves `index.html`.
- `/api` and `/api/*` reach the Worker first (`run_worker_first` in `wrangler.jsonc`). Today it answers only `GET /api/health` with `{ "ok": true }`, and returns 404 for any other `/api` path.
- The Worker has a D1 binding, `DB`, with no tables and no queries yet.

## Offline and install

`vite-plugin-pwa` generates the web app manifest and a service worker that precaches the built app, so the app opens with no connection (checked by `e2e/smoke.spec.ts`). `/api` paths are never served from the app shell. Icons are generated from `public/logo.svg` with `npx pwa-assets-generator` (`pwa-assets.config.ts`).

`public/_headers` sets the security headers for static assets. `vite preview` applies the same headers, minus HSTS, so a local production build runs under the production policy.

## Hosting

- `wrangler.jsonc` configures the Worker, its static assets and the D1 binding.
- The D1 `database_id` is a placeholder until the database is created in Cloudflare. `npm run worker:dev` builds the app and runs the Worker locally against a local D1.
- Nothing is deployed yet.

## Quality gates and releases

`npm run check:all` runs every check CI runs, in CI's order. Run it before pushing.

| Check | What it enforces |
|---|---|
| `format:check` | Prettier formatting. |
| `lint` | oxlint. In `src/engine/` it allows only `./` imports (no React, packages or Node modules) and rejects `fetch`, `globalThis`, the DOM, `Date`, `crypto` and `performance` (`.oxlintrc.json`). |
| `check:conventions` | No `.tsx` files or `Math.random` in the engine; grade labels only in `src/engine/config.ts`; never-negative wording in strings and JSX text under `src/`; no skipped, todo or focused tests (`scripts/check-conventions.mjs`). |
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
