/** Prior tab-model footprint for a worktree — used to decide whether an empty
 *  renderable count is a virgin workspace (seed a terminal) or a re-focus /
 *  emptied surface (must not spawn an empty duplicate shell). */
export type InitialTerminalSurfaceSnapshot = {
  runtimeTerminalCount: number
  unifiedTabCount: number
  groupCount: number
  hasLayout: boolean
  defaultTerminalTabsApplied: boolean
}

export type InitialTerminalSurfaceState = {
  tabsByWorktree?: Record<string, readonly unknown[]>
  unifiedTabsByWorktree?: Record<string, readonly unknown[]>
  groupsByWorktree?: Record<string, readonly unknown[]>
  layoutByWorktree?: Record<string, unknown>
  defaultTerminalTabsAppliedByWorktreeId?: Record<string, true>
}

export function readInitialTerminalSurfaceSnapshot(
  state: InitialTerminalSurfaceState,
  worktreeId: string
): InitialTerminalSurfaceSnapshot {
  return {
    runtimeTerminalCount: state.tabsByWorktree?.[worktreeId]?.length ?? 0,
    unifiedTabCount: state.unifiedTabsByWorktree?.[worktreeId]?.length ?? 0,
    groupCount: state.groupsByWorktree?.[worktreeId]?.length ?? 0,
    hasLayout: state.layoutByWorktree?.[worktreeId] != null,
    defaultTerminalTabsApplied: Boolean(state.defaultTerminalTabsAppliedByWorktreeId?.[worktreeId])
  }
}

export function hasPriorInitialTerminalSurface(surface: InitialTerminalSurfaceSnapshot): boolean {
  return (
    surface.runtimeTerminalCount > 0 ||
    surface.unifiedTabCount > 0 ||
    surface.groupCount > 0 ||
    surface.hasLayout ||
    surface.defaultTerminalTabsApplied
  )
}

export function shouldAutoCreateInitialTerminal(
  renderableTabCount: number,
  options?: {
    surface?: InitialTerminalSurfaceSnapshot
    /**
     * Activation carries setup/startup/default-tab intent and needs a host when
     * nothing renderable is mounted. Still refuses to mint a second shell when
     * a runtime terminal row already exists (caller should attach/queue on it).
     */
    forceIfEmpty?: boolean
  }
): boolean {
  // Why: the tab-group model is the source of truth for visible worktree content.
  if (renderableTabCount > 0) {
    return false
  }

  const surface = options?.surface

  if (options?.forceIfEmpty) {
    if (surface && surface.runtimeTerminalCount > 0) {
      return false
    }
    return true
  }

  // Why: count-only callers (legacy tests) keep the original "empty → seed" rule.
  if (!surface) {
    return true
  }

  // Why: any prior tab-model footprint means the workspace already had a surface
  // (or the user emptied it). Re-seeding on project switch / pane focus creates
  // the empty "Terminal N" duplicates users hit on the EcoUp side-by-side path.
  if (hasPriorInitialTerminalSurface(surface)) {
    return false
  }

  return true
}
