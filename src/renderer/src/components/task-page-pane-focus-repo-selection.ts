import type { Repo } from '../../../shared/types'

/**
 * CTX-02: with side-by-side panes, focusing a different pane's project must
 * surface its GitHub/PR/issue data on an already-open Tasks/GitHub screen
 * without leaving it. Additive only — never drops a repo the user explicitly
 * selected in the picker — so a deliberately narrowed selection is only ever
 * broadened, never silently overridden.
 *
 * Callers must gate `enabled` on the experimentalSideBySideWorkspaces flag:
 * outside that feature, activeRepoId changes 1:1 with explicit worktree
 * navigation and must not touch the picker at all (EDGE-02).
 *
 * Returns the SAME `selection` reference when nothing changes, so callers
 * can use this directly inside a `setState` updater without extra renders.
 */
export function withPaneFocusedRepoIncluded(
  selection: ReadonlySet<string>,
  activeRepoId: string | null,
  eligibleRepos: readonly Repo[],
  enabled: boolean
): ReadonlySet<string> {
  if (!enabled || !activeRepoId || selection.has(activeRepoId)) {
    return selection
  }
  if (!eligibleRepos.some((repo) => repo.id === activeRepoId)) {
    return selection
  }
  return new Set([...selection, activeRepoId])
}
