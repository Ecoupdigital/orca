import type { BrowserPage, BrowserWorkspace, WorkspaceSessionState } from '../../../shared/types'
import { pruneLocalTerminalScrollbackBuffers } from '../../../shared/workspace-session-terminal-buffers'
import { normalizeBrowserHistoryEntries } from '../../../shared/workspace-session-browser-history'
import type { AppState } from '../store'
import { buildEditorSessionData } from './workspace-session-editor-files'
import { buildPersistedUnifiedTabSessionData } from './workspace-session-unified-tabs'
import { buildLastVisitedAtByWorktreeId } from './workspace-session-focus-recency'
import { buildSleepingAgentSessionData } from './workspace-session-sleeping-agents'
import { buildActiveConnectionIdsAtShutdown } from './workspace-session-reconnect-targets'

export { buildActiveConnectionIdsAtShutdown }

/** Why (issue #1158): require both flags so a hydration failure can't overwrite orca-data.json with empty error-path state. */
export function shouldPersistWorkspaceSession(
  state: Pick<AppState, 'workspaceSessionReady' | 'hydrationSucceeded'>
): boolean {
  return state.workspaceSessionReady && state.hydrationSucceeded
}

export type WorkspaceSessionSnapshot = Pick<
  AppState,
  | 'activeRepoId'
  | 'activeWorkspaceKey'
  | 'activeWorktreeId'
  | 'activeTabId'
  | 'tabsByWorktree'
  | 'ptyIdsByTabId'
  | 'terminalLayoutsByTabId'
  | 'activeTabIdByWorktree'
  | 'openFiles'
  | 'editorDrafts'
  | 'markdownFrontmatterVisible'
  | 'activeFileIdByWorktree'
  | 'activeTabTypeByWorktree'
  | 'browserTabsByWorktree'
  | 'browserPagesByWorkspace'
  | 'activeBrowserTabIdByWorktree'
  | 'browserUrlHistory'
  | 'unifiedTabsByWorktree'
  | 'groupsByWorktree'
  | 'layoutByWorktree'
  | 'activeGroupIdByWorktree'
  | 'sshConnectionStates'
  | 'repos'
  | 'worktreesByRepo'
  | 'lastKnownRelayPtyIdByTabId'
  | 'lastVisitedAtByWorktreeId'
  | 'defaultTerminalTabsAppliedByWorktreeId'
> & {
  activeWorkspaceExecutionHostId?: AppState['activeWorkspaceExecutionHostId']
  sleepingAgentSessionsByPaneKey?: AppState['sleepingAgentSessionsByPaneKey']
  workspaceSplitLayout?: AppState['workspaceSplitLayout']
  workspaceSplitLayoutsByAnchor?: AppState['workspaceSplitLayoutsByAnchor']
  activeWorkspaceSplitAnchorId?: AppState['activeWorkspaceSplitAnchorId']
  workspaceSplitAnchorMru?: AppState['workspaceSplitAnchorMru']
  workspaceSplitMaximizedPaneId?: AppState['workspaceSplitMaximizedPaneId']
}

// Why: shallow-equality gate for the debounced session writer; _exhaustive below keeps it in sync with the snapshot type.
export const SESSION_RELEVANT_FIELDS = [
  'activeRepoId',
  'activeWorkspaceKey',
  'activeWorkspaceExecutionHostId',
  'activeWorktreeId',
  'activeTabId',
  'tabsByWorktree',
  'ptyIdsByTabId',
  'terminalLayoutsByTabId',
  'activeTabIdByWorktree',
  'openFiles',
  'editorDrafts',
  'markdownFrontmatterVisible',
  'activeFileIdByWorktree',
  'activeTabTypeByWorktree',
  'browserTabsByWorktree',
  'browserPagesByWorkspace',
  'activeBrowserTabIdByWorktree',
  'browserUrlHistory',
  'unifiedTabsByWorktree',
  'groupsByWorktree',
  'layoutByWorktree',
  'activeGroupIdByWorktree',
  'sshConnectionStates',
  'repos',
  'worktreesByRepo',
  'lastKnownRelayPtyIdByTabId',
  'lastVisitedAtByWorktreeId',
  'defaultTerminalTabsAppliedByWorktreeId',
  'sleepingAgentSessionsByPaneKey',
  'workspaceSplitLayout',
  'workspaceSplitLayoutsByAnchor',
  'activeWorkspaceSplitAnchorId',
  'workspaceSplitAnchorMru',
  'workspaceSplitMaximizedPaneId'
] as const satisfies readonly (keyof WorkspaceSessionSnapshot)[]

type _MissingSessionField = Exclude<
  keyof WorkspaceSessionSnapshot,
  (typeof SESSION_RELEVANT_FIELDS)[number]
>
void (true satisfies [_MissingSessionField] extends [never] ? true : never)

export function buildBrowserSessionData(
  browserTabsByWorktree: Record<string, BrowserWorkspace[]>,
  browserPagesByWorkspace: Record<string, BrowserPage[]>,
  activeBrowserTabIdByWorktree: Record<string, string | null>
): Pick<
  WorkspaceSessionState,
  'browserTabsByWorktree' | 'browserPagesByWorkspace' | 'activeBrowserTabIdByWorktree'
> {
  return {
    // Why: guest webContents are recreated on restore, so persist only lightweight chrome state (loading reset to false).
    browserTabsByWorktree: buildPersistedBrowserTabsByWorktree(browserTabsByWorktree),
    browserPagesByWorkspace: buildPersistedBrowserPagesByWorkspace(browserPagesByWorkspace),
    activeBrowserTabIdByWorktree
  }
}

export function buildPersistedBrowserTabsByWorktree(
  browserTabsByWorktree: Record<string, BrowserWorkspace[]>
): WorkspaceSessionState['browserTabsByWorktree'] {
  return Object.fromEntries(
    Object.entries(browserTabsByWorktree).map(([worktreeId, tabs]) => [
      worktreeId,
      tabs.map((tab) => ({ ...tab, loading: false }))
    ])
  )
}

export function buildPersistedBrowserPagesByWorkspace(
  browserPagesByWorkspace: Record<string, BrowserPage[]>
): WorkspaceSessionState['browserPagesByWorkspace'] {
  return Object.fromEntries(
    Object.entries(browserPagesByWorkspace).map(([workspaceId, pages]) => [
      workspaceId,
      pages.map((page) => ({ ...page, loading: false }))
    ])
  )
}

export function buildSanitizedTabsByWorktree(
  tabsByWorktree: WorkspaceSessionSnapshot['tabsByWorktree']
): WorkspaceSessionState['tabsByWorktree'] {
  // Why: strip transient pendingActivationSpawn — session:set persists without Zod re-parse, so a stale flag would drop the first PTY spawn on restart.
  return Object.fromEntries(
    Object.entries(tabsByWorktree).map(([worktreeId, tabs]) => [
      worktreeId,
      tabs.map((tab) => {
        const { pendingActivationSpawn: _unused, ...rest } = tab
        void _unused
        return rest
      })
    ])
  )
}

export function buildTerminalSessionData(
  snapshot: WorkspaceSessionSnapshot
): Pick<WorkspaceSessionState, 'activeWorktreeIdsOnShutdown' | 'remoteSessionIdsByTabId'> {
  const tabsByWorktree = snapshot.tabsByWorktree

  // Why: use ptyIdsByTabId (live PTYs), not tab.ptyId, which sleep preserves as a wake hint and would revive slept worktrees as active.
  const ptyIdsByTabId = snapshot.ptyIdsByTabId
  const hasLivePty = (tabId: string): boolean => (ptyIdsByTabId[tabId]?.length ?? 0) > 0

  // Why: relay reconnect keeps lastKnown but clears tab.ptyId; the !tab.ptyId guard excludes slept tabs (which keep ptyId as a wake hint).
  const lastKnown = snapshot.lastKnownRelayPtyIdByTabId
  const hasReconnectableSession = (tab: { id: string; ptyId: string | null }): boolean =>
    hasLivePty(tab.id) || (!tab.ptyId && Boolean(lastKnown[tab.id]))

  const activeWorktreeIdsOnShutdown = Object.entries(tabsByWorktree)
    .filter(([, tabs]) => tabs.some(hasReconnectableSession))
    .map(([worktreeId]) => worktreeId)

  const worktreeById = new Map(
    Object.values(snapshot.worktreesByRepo)
      .flat()
      .map((worktree) => [worktree.id, worktree])
  )
  const repoById = new Map(snapshot.repos.map((repo) => [repo.id, repo]))

  // Why: derive here to avoid a fragile sync IPC round-trip during beforeunload (Chromium can drop it under shutdown pressure).
  // Why: pre-indexed above so large workspaces don't rescan every repo/worktree per terminal tab while the renderer is quitting.
  const remoteSessionIdsByTabId: Record<string, string> = {}
  for (const [worktreeId, tabs] of Object.entries(tabsByWorktree)) {
    const worktree = worktreeById.get(worktreeId)
    const repo = worktree ? repoById.get(worktree.repoId) : null
    if (!repo?.connectionId) {
      continue
    }
    for (const tab of tabs) {
      if (!hasReconnectableSession(tab)) {
        continue
      }
      const sessionId = tab.ptyId || lastKnown[tab.id]
      if (sessionId) {
        remoteSessionIdsByTabId[tab.id] = sessionId
      }
    }
  }

  return {
    activeWorktreeIdsOnShutdown,
    remoteSessionIdsByTabId:
      Object.keys(remoteSessionIdsByTabId).length > 0 ? remoteSessionIdsByTabId : undefined
  }
}

export function buildWorkspaceSessionPayload(
  snapshot: WorkspaceSessionSnapshot
): WorkspaceSessionState {
  const terminalSessionData = buildTerminalSessionData(snapshot)

  const payload = {
    activeRepoId: snapshot.activeRepoId,
    activeWorkspaceKey: snapshot.activeWorkspaceKey,
    activeWorkspaceExecutionHostId: snapshot.activeWorkspaceExecutionHostId,
    activeWorktreeId: snapshot.activeWorktreeId,
    activeTabId: snapshot.activeTabId,
    tabsByWorktree: buildSanitizedTabsByWorktree(snapshot.tabsByWorktree),
    terminalLayoutsByTabId: snapshot.terminalLayoutsByTabId,
    // Why: session:set fully replaces the persisted object, so dropping this silently disables eager terminal reconnect on restart.
    activeWorktreeIdsOnShutdown: terminalSessionData.activeWorktreeIdsOnShutdown,
    workspaceSplitLayoutOnShutdown: snapshot.workspaceSplitLayout ?? undefined,
    workspaceSplitLayoutsByAnchorOnShutdown: snapshot.workspaceSplitLayoutsByAnchor,
    activeWorkspaceSplitAnchorOnShutdown: snapshot.activeWorkspaceSplitAnchorId,
    workspaceSplitAnchorMruOnShutdown: snapshot.workspaceSplitAnchorMru,
    workspaceSplitMaximizedPaneOnShutdown: snapshot.workspaceSplitMaximizedPaneId,
    activeTabIdByWorktree: snapshot.activeTabIdByWorktree,
    ...buildEditorSessionData(
      snapshot.openFiles,
      snapshot.editorDrafts,
      snapshot.markdownFrontmatterVisible,
      snapshot.activeFileIdByWorktree,
      snapshot.activeTabTypeByWorktree
    ),
    ...buildBrowserSessionData(
      snapshot.browserTabsByWorktree,
      snapshot.browserPagesByWorkspace,
      snapshot.activeBrowserTabIdByWorktree
    ),
    // Why: enforce the history storage cap here so stale renderer state can't make every write stringify an oversized legacy array.
    browserUrlHistory: normalizeBrowserHistoryEntries(snapshot.browserUrlHistory),
    // Why: persist only layouts backed by real tabs so a reload can't restore a blank split pane from the split-before-tab midpoint.
    ...buildPersistedUnifiedTabSessionData(snapshot),
    activeConnectionIdsAtShutdown: buildActiveConnectionIdsAtShutdown(
      snapshot,
      terminalSessionData.remoteSessionIdsByTabId ?? null
    ),
    remoteSessionIdsByTabId: terminalSessionData.remoteSessionIdsByTabId,
    // Why: omit when empty so builds that never stamped focus-recency don't bloat the payload. See docs/cmd-j-empty-query-ordering.md.
    lastVisitedAtByWorktreeId: buildLastVisitedAtByWorktreeId(snapshot),
    defaultTerminalTabsAppliedByWorktreeId:
      snapshot.defaultTerminalTabsAppliedByWorktreeId &&
      Object.keys(snapshot.defaultTerminalTabsAppliedByWorktreeId).length > 0
        ? snapshot.defaultTerminalTabsAppliedByWorktreeId
        : undefined,
    ...buildSleepingAgentSessionData(snapshot)
  }

  return pruneLocalTerminalScrollbackBuffers(payload, snapshot.repos)
}
