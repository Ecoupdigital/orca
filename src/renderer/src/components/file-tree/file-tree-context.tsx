import { createContext, useContext } from 'react'
import { useAppStore } from '@/store'
import type { DetectedWorktree, Worktree } from '../../../../shared/types'

export type FileTreeContextValue = {
  /** Worktree that this tree displays; independent of the global active worktree. */
  worktreeId: string
}

/** Provider present = pane mode (explorer embedded in a workspace split).
 *  No provider = global right-sidebar explorer (upstream behavior). */
export const FileTreeWorktreeContext = createContext<FileTreeContextValue | null>(null)

export function useIsFileTreePaneMode(): boolean {
  return useContext(FileTreeWorktreeContext) !== null
}

export function useFileTreeWorktreeId(): string | null {
  const ctx = useContext(FileTreeWorktreeContext)
  const globalActiveWorktreeId = useAppStore((s) => s.activeWorktreeId)
  return ctx ? ctx.worktreeId : globalActiveWorktreeId
}

/** Parity with useActiveWorktree(): same getKnownWorktreeById path. */
export function useFileTreeWorktree(): Worktree | DetectedWorktree | null {
  const worktreeId = useFileTreeWorktreeId()
  return useAppStore((s) => (worktreeId ? (s.getKnownWorktreeById(worktreeId) ?? null) : null))
}
