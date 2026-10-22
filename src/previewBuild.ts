// Whether a build is for a PR preview, from the branch Workers Builds is building (ARCHITECTURE.md "Hosting").
// vite.config.ts bakes the answer into the app; `main` and a local build are never previews.
export const PRODUCTION_BRANCH = 'main'

export const isPreviewBranch = (branch: string | undefined): boolean =>
  branch !== undefined && branch !== '' && branch !== PRODUCTION_BRANCH
