import type { StateCreator } from 'zustand'
import type { AppState } from '../types'

export const PANE_EXPLORER_MIN_WIDTH = 160
export const PANE_EXPLORER_MAX_WIDTH = 480
export const PANE_EXPLORER_DEFAULT_WIDTH = 240

export type PaneExplorerEntry = {
  expanded: boolean
  width: number
}

export type PaneExplorerSlice = {
  /** Explorer state per pane. Panes are keyed by worktreeId (a worktree
   *  lives in at most one split; see WorkspacePaneNode). Missing entry =
   *  collapsed at default width. */
  paneExplorerByWorktree: Record<string, PaneExplorerEntry>
  togglePaneExplorer: (worktreeId: string) => void
  setPaneExplorerWidth: (worktreeId: string, width: number) => void
}

export function clampPaneExplorerWidth(width: number): number {
  if (!Number.isFinite(width)) {
    return PANE_EXPLORER_DEFAULT_WIDTH
  }
  return Math.min(PANE_EXPLORER_MAX_WIDTH, Math.max(PANE_EXPLORER_MIN_WIDTH, Math.round(width)))
}

export function getPaneExplorerEntry(
  byWorktree: Record<string, PaneExplorerEntry>,
  worktreeId: string
): PaneExplorerEntry {
  return byWorktree[worktreeId] ?? { expanded: false, width: PANE_EXPLORER_DEFAULT_WIDTH }
}

/** Purge-path helper (mirrors pruneWorkspaceSplitState): drop entries for
 *  removed worktrees so closing a project leaves no orphan explorer state.
 *  Returns the SAME paneExplorerByWorktree reference when nothing changes,
 *  so callers can spread this into a wider store patch without triggering
 *  spurious re-renders on unrelated purges. */
export function prunePaneExplorerState(
  state: Pick<AppState, 'paneExplorerByWorktree'>,
  removedWorktreeIds: ReadonlySet<string>
): Pick<AppState, 'paneExplorerByWorktree'> {
  const current = state.paneExplorerByWorktree
  if (removedWorktreeIds.size === 0) {
    return { paneExplorerByWorktree: current }
  }
  const hasRemovedEntry = Object.keys(current).some((worktreeId) =>
    removedWorktreeIds.has(worktreeId)
  )
  if (!hasRemovedEntry) {
    return { paneExplorerByWorktree: current }
  }
  const next: Record<string, PaneExplorerEntry> = {}
  for (const [worktreeId, entry] of Object.entries(current)) {
    if (!removedWorktreeIds.has(worktreeId)) {
      next[worktreeId] = entry
    }
  }
  return { paneExplorerByWorktree: next }
}

export const createPaneExplorerSlice: StateCreator<AppState, [], [], PaneExplorerSlice> = (
  set,
  get
) => ({
  paneExplorerByWorktree: {},

  togglePaneExplorer: (worktreeId) => {
    const current = getPaneExplorerEntry(get().paneExplorerByWorktree, worktreeId)
    set({
      paneExplorerByWorktree: {
        ...get().paneExplorerByWorktree,
        [worktreeId]: { ...current, expanded: !current.expanded }
      }
    })
  },

  setPaneExplorerWidth: (worktreeId, width) => {
    const current = getPaneExplorerEntry(get().paneExplorerByWorktree, worktreeId)
    set({
      paneExplorerByWorktree: {
        ...get().paneExplorerByWorktree,
        [worktreeId]: { ...current, width: clampPaneExplorerWidth(width) }
      }
    })
  }
})
