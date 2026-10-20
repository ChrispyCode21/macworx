# PIPELINE.md

How the models split the work. The goal: Opus judgment where a mistake can hide, Sonnet everywhere else, and automated checks before any model reviews anything.

[nightshift](https://github.com/ChrispyCode21/nightshift) runs this pipeline on the owner's machine, configured by `.claude/nightshift.json`: a builder at 2:00 AM and a reviewer at 4:00 AM Central, and on pushes to agent and Dependabot branches. The builder takes issues from the lowest open version milestone.

## Stages

| Stage | Who | Reads | Produces |
| --- | --- | --- | --- |
| Plan | Sonnet 5.5 | The issue, SPEC.md, the files it will touch | A plan: files to change, approach, tests to add, estimated lines |
| Plan review | Opus 5.5 | The plan, the issue, the relevant SPEC.md sections | Approve, or revise with reasons (200 words max) |
| Build | Sonnet 5.5 | The approved plan | A branch and a PR |
| Gates | CI (no model) | The PR | Pass or fail: format, lint, conventions, spec coverage, tests, build, Playwright, CodeQL, dependency review |
| Code review | Sonnet 5.5 or Opus 5.5 (see "Risk tiers") | The diff, the plan, the issue | Ranked findings |
| Merge | nightshift's reviewer, or the owner (see "Who merges") | The PR and the review | Merged, held with reasons, or sent back |

## Why a plan review instead of the advisor

Claude Code's advisor (`/advisor opus`) lets Sonnet consult Opus mid-task. Each consultation reads the entire conversation, uncached, so it gets more expensive as a session grows. A plan review sends Opus only the plan and the spec, which is short, and catches a wrong approach before Sonnet spends tokens building it.

The advisor is still useful in interactive local sessions on hard debugging. Turn it on with `/advisor opus` and off with `/advisor off`.

## When the plan skips Opus

The plan is still written, in one line, but Opus doesn't review it when the change is:

- Docs or copy text only
- A dependency patch or minor bump
- 50 lines or fewer that repeat an existing pattern already covered by tests

## Risk tiers for code review

Opus reviews any PR that touches:

- `src/engine/` or the payout and grade config
- `migrations/` or D1 queries
- The Worker's auth, Cloudflare Access, or the parent API
- Offline storage and syncing
- CI workflows or rulesets

Everything else gets a Sonnet review. The `high-risk` label forces Opus.

## Review rules

- The reviewer reads the diff, the plan and the issue, never the build conversation.
- At most 10 findings, ranked by severity. Each one names a file and line and a concrete way it fails.
- Nothing CI already checks (formatting, lint, types).

## Limits

- **CI failures:** the builder gets one fix attempt per failing check, for at most 2 rounds. After that it stops and comments on the PR for the owner.
- **Plan review:** at most 2 revise rounds, then it goes to the owner.
- **Timeouts:** triage 10 minutes, build 45 minutes.

## Who merges

`merge-gate.yml` labels every PR but Dependabot's from the paths it changes. The reviewer reviews and fixes a labeled PR, then comments that it's ready and leaves the merge to the owner. It merges everything else itself once CI is green.

| Label | Paths | Why the owner merges |
| --- | --- | --- |
| `touches-data` | `migrations/`, `worker/`, `src/storage/` | Merging deploys: migrations run on her real D1 data, and the Worker guards auth, pairing and the parent API. |
| `touches-gates` | `scripts/`, lint, format, type and test config, `public/_headers`, `wrangler*.jsonc`, workflows and rulesets | It changes what decides green. |

Release PRs, and Dependabot PRs that touch workflows, also wait for the owner. Labels are only added by the workflow; the owner can remove one.
