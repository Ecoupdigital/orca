import { describe, expect, it } from 'vitest'
import type { Repo } from '../../../shared/types'
import { withPaneFocusedRepoIncluded } from './task-page-pane-focus-repo-selection'

function repo(overrides: Partial<Repo> & Pick<Repo, 'id'>): Repo {
  return {
    path: `/repos/${overrides.id}`,
    displayName: overrides.id,
    badgeColor: '#737373',
    addedAt: 100,
    kind: 'git',
    ...overrides
  }
}

describe('withPaneFocusedRepoIncluded', () => {
  const repos = [repo({ id: 'repo-a' }), repo({ id: 'repo-b' })]

  it('adds the newly focused repo to the selection when enabled', () => {
    const selection = new Set(['repo-a'])

    const result = withPaneFocusedRepoIncluded(selection, 'repo-b', repos, true)

    expect([...result].sort()).toEqual(['repo-a', 'repo-b'])
  })

  it('never drops an existing selection — additive only', () => {
    const selection = new Set(['repo-a'])

    const result = withPaneFocusedRepoIncluded(selection, 'repo-b', repos, true)

    expect(result.has('repo-a')).toBe(true)
  })

  it('returns the same reference when the repo is already selected (no-op)', () => {
    const selection = new Set(['repo-a', 'repo-b'])

    const result = withPaneFocusedRepoIncluded(selection, 'repo-b', repos, true)

    expect(result).toBe(selection)
  })

  it('returns the same reference when disabled (flag off, EDGE-02)', () => {
    const selection = new Set(['repo-a'])

    const result = withPaneFocusedRepoIncluded(selection, 'repo-b', repos, false)

    expect(result).toBe(selection)
  })

  it('returns the same reference when activeRepoId is null', () => {
    const selection = new Set(['repo-a'])

    const result = withPaneFocusedRepoIncluded(selection, null, repos, true)

    expect(result).toBe(selection)
  })

  it('returns the same reference when the repo is not eligible (e.g. folder workspace)', () => {
    const selection = new Set(['repo-a'])

    const result = withPaneFocusedRepoIncluded(selection, 'unknown-repo', repos, true)

    expect(result).toBe(selection)
  })
})
