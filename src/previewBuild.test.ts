import { describe, expect, it } from 'vitest'
import { isPreviewBranch } from './previewBuild'

describe('isPreviewBranch', () => {
  it('is false for main, an unset branch and an empty one, so production and local builds are never previews', () => {
    expect(isPreviewBranch('main')).toBe(false)
    expect(isPreviewBranch(undefined)).toBe(false)
    expect(isPreviewBranch('')).toBe(false)
  })

  it('is true for any other branch', () => {
    expect(isPreviewBranch('preview-pairing')).toBe(true)
    expect(isPreviewBranch('agent/issue-1')).toBe(true)
  })
})
