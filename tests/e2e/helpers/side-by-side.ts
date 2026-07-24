/**
 * Shared side-by-side workspace helpers for e2e specs.
 *
 * Why a separate file: `side-by-side-workspaces.spec.ts` (the upstream PR's
 * spec) defines `enableSideBySideWorkspaces`/`getSplitLeafIds`/
 * `createSecondWorktree` locally. Phase 2's new specs (pane-explorer,
 * pane-focus-context) need the same setup without editing that spec, so
 * these are copies extracted here plus two new pane-scoped locators.
 */

import type { Page } from '@stablyai/playwright-test'

type SplitLeafIds = string[]

/** Turn on the side-by-side workspaces experimental flag for the running
 *  E2E session, without requiring a relaunch. */
export async function enableSideBySideWorkspaces(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const settings = await window.api.settings.set({ experimentalSideBySideWorkspaces: true })
    // Why: E2E profiles use production defaults; the store must see the flag
    // immediately without a relaunch.
    window.__store?.setState({ settings })
  })
}

/** Left-to-right worktreeIds of the current split's leaves ([] when no
 *  split is active). */
export async function getSplitLeafIds(page: Page): Promise<SplitLeafIds> {
  return page.evaluate(() => {
    const store = window.__store
    if (!store) {
      return []
    }
    type PaneNode =
      | { type: 'pane'; worktreeId: string }
      | { type: 'split'; first: PaneNode; second: PaneNode }
    const layout = (store.getState() as { workspaceSplitLayout?: PaneNode | null })
      .workspaceSplitLayout
    if (!layout) {
      return []
    }
    const leaves: string[] = []
    const walk = (node: PaneNode): void => {
      if (node.type === 'pane') {
        leaves.push(node.worktreeId)
        return
      }
      walk(node.first)
      walk(node.second)
    }
    walk(layout)
    return leaves
  })
}

/** Create a second worktree in the same repo as the currently active
 *  worktree (does not activate it or open it in a pane). */
export async function createSecondWorktree(page: Page, name: string): Promise<string> {
  return page.evaluate(async (worktreeName) => {
    const store = window.__store
    if (!store) {
      throw new Error('window.__store is unavailable')
    }
    const state = store.getState()
    const activeWorktreeId = state.activeWorktreeId
    const activeWorktree = Object.values(state.worktreesByRepo)
      .flat()
      .find((worktree) => worktree.id === activeWorktreeId)
    if (!activeWorktree) {
      throw new Error('active worktree not found')
    }
    const result = await state.createWorktree(activeWorktree.repoId, worktreeName)
    await state.fetchWorktrees(activeWorktree.repoId)
    return result.worktree.id
  }, name)
}

/** Open worktreeId to the side of the active one via the store action
 *  (equivalent to "Open to the Side" from the sidebar context menu). */
export async function openWorktreeToTheSide(page: Page, worktreeId: string): Promise<void> {
  await page.evaluate((id) => {
    const opened = window.__store!.getState().openWorkspacePane(id)
    if (!opened) {
      throw new Error(`openWorkspacePane(${id}) returned false`)
    }
  }, worktreeId)
}

/** The visible split pane surface for worktreeId (WorktreeSplitSurface). */
export function paneLocator(page: Page, worktreeId: string): ReturnType<Page['locator']> {
  return page.locator(`[data-workspace-pane-id=${JSON.stringify(worktreeId)}]`)
}

/** The embedded PaneExplorerColumn for worktreeId, expanded or collapsed. */
export function paneExplorerLocator(page: Page, worktreeId: string): ReturnType<Page['locator']> {
  return page.locator(`[data-pane-explorer=${JSON.stringify(worktreeId)}]`)
}
