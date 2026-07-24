import { useAppStore } from '@/store'

/** Promote a split pane to the global focus: activeWorktreeId AND
 *  activeRepoId follow the pane's project, so every repo-keyed surface
 *  (GitHub view, source control, checks) tracks the focused pane.
 *  Why no setActiveView: focusing a pane must never switch screens —
 *  a user reading the GitHub view keeps the view, now scoped to the
 *  focused pane's repo. */
export function promotePaneFocusContext(worktreeId: string): void {
  const state = useAppStore.getState()
  if (state.activeWorktreeId !== worktreeId) {
    state.setActiveWorktree(worktreeId)
  }
  const worktree = state.getKnownWorktreeById(worktreeId)
  if (worktree && worktree.repoId !== useAppStore.getState().activeRepoId) {
    useAppStore.getState().setActiveRepo(worktree.repoId)
  }
}
