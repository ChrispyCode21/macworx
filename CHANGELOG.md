# Changelog

All notable changes to macworx. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

To release: in a PR, move the "Unreleased" notes under a new version heading and bump `version` in `package.json` to match. Merging tags the release automatically (see ARCHITECTURE.md, "Quality gates and releases").

## [Unreleased]

### Added

- **Live on Cloudflare:** every merge to `main` deploys the app, so it can be opened and installed on the iPad from its workers.dev address. Each pull request gets its own preview address.

## [0.0.0] - 2026-10-17

### Added

- **Project scaffold:** the app installs to the iPad's home screen from Safari and opens offline. It shows only its name for now.
