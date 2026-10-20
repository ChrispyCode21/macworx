# Changelog

All notable changes to macworx. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

To release: in a PR, move the "Unreleased" notes under a new version heading and bump `version` in `package.json` to match (`npm version X.Y.Z --no-git-tag-version`). Merging tags the release and closes its milestone automatically (see ARCHITECTURE.md, "Quality gates and releases").

## [Unreleased]

### Added

- **Pair her iPad:** in the installed app, Home shows **Pair this iPad** until the iPad is paired. A parent's 6-digit code goes in on the number pad, and the iPad keeps its key. If a parent later unpairs it, the button comes back. Practice works either way.

## [0.1.1] - 2026-10-19

### Fixed

- **Her answer stays put after Check:** the boxes used to switch to the right answer, so her own boxes seemed to show the answer she'd gotten wrong. Now they keep exactly what she typed, tinted soft green when it's right and soft coral when it isn't, and the right answer appears only in the line above Next.

## [0.1.0] - 2026-10-17

Practice on the iPad: 20 math problems at a time, worked on paper-style columns, live on Cloudflare.

### Added

- **Do an assignment:** tap Start for 20 math problems, stacked like on paper with an answer box under each column, and answer each on a big number pad. Addition and subtraction answers fill from the ones place, the way she works them on paper. A right answer gets a cheer; otherwise the app shows how the problem works out. Tap Next when ready. At the end, see how many were right, the grade and the Macaronis earned. Tap "Done for now" to stop early and keep the Macaronis earned so far. Macaronis aren't saved yet.
- **Live on Cloudflare:** every merge to `main` deploys the app, so it can be opened and installed on the iPad from its workers.dev address. Each pull request gets its own preview address.

## [0.0.0] - 2026-10-17

### Added

- **Project scaffold:** the app installs to the iPad's home screen from Safari and opens offline. It shows only its name for now.
