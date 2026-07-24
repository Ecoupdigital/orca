/**
 * Embedded per-pane file explorer (PANE-02/03/04, PERSIST-01/02, EDGE-01).
 *
 * Covers Phase 2 of the split-view feature, layered on top of the upstream
 * PR #9439 side-by-side workspaces (tested separately in
 * side-by-side-workspaces.spec.ts, which this spec does not touch):
 *   - Opening a file from pane B's own explorer tree lands the editor tab
 *     in pane B, not the globally focused pane (TEST-02).
 *   - The tree and its filesystem watcher only mount while the pane's
 *     explorer column is expanded; collapsing tears the watcher down
 *     (PANE-03).
 *   - Split layout (tree + ratio) and per-pane explorer state (expanded +
 *     width) both survive a full app relaunch (PERSIST-01, PERSIST-02).
 *   - Removing a worktree that has an open pane closes it cleanly and
 *     purges its explorer entry, with no orphaned state or console errors
 *     (EDGE-01).
 */

import { existsSync, readFileSync } from 'node:fs'
import type { ElectronApplication } from '@stablyai/playwright-test'
import { test, expect } from './helpers/orca-app'
import {
  getActiveWorktreeId,
  switchToWorktree,
  waitForActiveWorktree,
  waitForSessionReady
} from './helpers/store'
import { attachRepoAndOpenTerminal, createRestartSession } from './helpers/orca-restart'
import {
  createSecondWorktree,
  enableSideBySideWorkspaces,
  getSplitLeafIds,
  openWorktreeToTheSide,
  paneExplorerLocator,
  paneLocator
} from './helpers/side-by-side'
import { TEST_REPO_PATH_FILE } from './global-setup'

function seededRepoPathOrSkip(): string {
  const repoPath = existsSync(TEST_REPO_PATH_FILE)
    ? readFileSync(TEST_REPO_PATH_FILE, 'utf-8').trim()
    : ''
  test.skip(!repoPath || !existsSync(repoPath), 'Global setup did not produce a seeded test repo')
  return repoPath
}

/** Expand a pane's explorer column via its rail toggle button (the collapsed
 *  variant renders exactly one button) and wait for the tree to mount. */
async function expandPaneExplorer(page: Parameters<typeof paneLocator>[0], worktreeId: string) {
  await paneExplorerLocator(page, worktreeId).locator('button').click()
  await expect(
    paneExplorerLocator(page, worktreeId).locator('[data-orca-explorer-shell]')
  ).toBeVisible({ timeout: 15_000 })
}

test.describe('embedded per-pane explorer', () => {
  test('file opened from pane B tree lands in pane B (TEST-02)', async ({ orcaPage: page }) => {
    test.setTimeout(180_000)
    await waitForSessionReady(page)
    const primaryId = await waitForActiveWorktree(page)
    await enableSideBySideWorkspaces(page)

    const sideId = await createSecondWorktree(page, `e2e-explorer-pane-${Date.now()}`)
    await openWorktreeToTheSide(page, sideId)
    await expect.poll(() => getSplitLeafIds(page), { timeout: 30_000 }).toEqual([primaryId, sideId])

    // Expand the explorer in both panes.
    await expandPaneExplorer(page, primaryId)
    await expandPaneExplorer(page, sideId)

    // Click a seeded file inside pane B's own tree (not the global right
    // sidebar, and not pane A's tree, which shows the same filename since
    // both worktrees are checkouts of the same repo).
    const fileRow = paneExplorerLocator(page, sideId)
      .locator('[data-file-explorer-row]')
      .filter({ hasText: 'CLAUDE.md' })
      .first()
    await expect(fileRow).toBeVisible({ timeout: 15_000 })
    await fileRow.click()

    // The click promotes pane B's focus (pointerdown-capture on the pane
    // surface), even though the file lives in a non-globally-focused pane.
    await expect.poll(() => getActiveWorktreeId(page), { timeout: 10_000 }).toBe(sideId)

    const clickedFile = await page.evaluate((worktreeId) => {
      const store = window.__store
      if (!store) {
        return null
      }
      return (
        store
          .getState()
          .openFiles.find(
            (file) => file.worktreeId === worktreeId && file.relativePath === 'CLAUDE.md'
          ) ?? null
      )
    }, sideId)
    expect(clickedFile).not.toBeNull()

    const [tabsInB, tabsInA] = await page.evaluate(
      ([bId, aId, filePath]) => {
        const store = window.__store
        if (!store) {
          return [[], []] as const
        }
        const state = store.getState()
        const inB = (state.unifiedTabsByWorktree[bId] ?? []).filter(
          (tab) => tab.contentType === 'editor' && tab.entityId === filePath
        )
        const inA = (state.unifiedTabsByWorktree[aId] ?? []).filter(
          (tab) => tab.contentType === 'editor' && tab.entityId === filePath
        )
        return [inB, inA] as const
      },
      [sideId, primaryId, clickedFile!.id] as const
    )
    expect(tabsInB.length).toBe(1)
    expect(tabsInA.length).toBe(0)

    // Render-layer proof: the editor tab is visible inside pane B's surface.
    await expect(paneLocator(page, sideId).locator('.editor-header-path').first()).toContainText(
      'CLAUDE.md',
      { timeout: 10_000 }
    )
  })

  test('tree and watcher mount lazily (PANE-03)', async ({ orcaPage: page }) => {
    test.setTimeout(180_000)
    await waitForSessionReady(page)
    const primaryId = await waitForActiveWorktree(page)
    await enableSideBySideWorkspaces(page)

    const sideId = await createSecondWorktree(page, `e2e-lazy-pane-${Date.now()}`)
    await openWorktreeToTheSide(page, sideId)
    await expect.poll(() => getSplitLeafIds(page), { timeout: 30_000 }).toEqual([primaryId, sideId])

    // Fresh split: both panes' explorers start collapsed, so the tree (and
    // its filesystem watcher) has never mounted.
    await expect(paneExplorerLocator(page, sideId)).toHaveAttribute(
      'data-pane-explorer-collapsed',
      ''
    )
    await expect(paneLocator(page, sideId).locator('[data-orca-explorer-shell]')).toHaveCount(0)

    await expandPaneExplorer(page, sideId)
    await expect(paneLocator(page, sideId).locator('[data-orca-explorer-shell]')).toHaveCount(1)

    // Collapsing unmounts the tree, which is what tears the watcher down.
    await paneExplorerLocator(page, sideId).locator('button').first().click()
    await expect(paneExplorerLocator(page, sideId)).toHaveAttribute(
      'data-pane-explorer-collapsed',
      ''
    )
    await expect(paneLocator(page, sideId).locator('[data-orca-explorer-shell]')).toHaveCount(0)
  })

  test('layout and explorer state survive relaunch (PERSIST-01, PERSIST-02)', async (// oxlint-disable-next-line no-empty-pattern -- Playwright's second fixture arg is testInfo; the first must be an object destructure to opt out of the default fixture set.
  {}, testInfo) => {
    test.setTimeout(300_000)
    const repoPath = seededRepoPathOrSkip()
    const session = createRestartSession(testInfo)
    let firstApp: ElectronApplication | null = null
    let secondApp: ElectronApplication | null = null
    try {
      const first = await session.launch()
      firstApp = first.app
      await waitForSessionReady(first.page)
      const primaryId = await attachRepoAndOpenTerminal(first.page, repoPath)
      await enableSideBySideWorkspaces(first.page)
      const sideId = await createSecondWorktree(first.page, `e2e-persist-pane-${Date.now()}`)
      await openWorktreeToTheSide(first.page, sideId)
      await expect
        .poll(() => getSplitLeafIds(first.page), { timeout: 30_000 })
        .toEqual([primaryId, sideId])

      // Non-default ratio (default is 0.5) so relaunch can prove it round-trips.
      await first.page.evaluate(() => {
        const store = window.__store
        if (!store) {
          throw new Error('window.__store is unavailable')
        }
        store.getState().setWorkspaceSplitRatio([], 0.3)
      })

      // Expand pane B's explorer with a non-default width (default is 240).
      await first.page.evaluate((worktreeId) => {
        const store = window.__store
        if (!store) {
          throw new Error('window.__store is unavailable')
        }
        store.getState().togglePaneExplorer(worktreeId)
        store.getState().setPaneExplorerWidth(worktreeId, 320)
      }, sideId)
      await expect(
        paneLocator(first.page, sideId).locator('[data-orca-explorer-shell]')
      ).toBeVisible({ timeout: 15_000 })

      // Let the 150ms debounced UI writer flush before closing.
      await first.page.waitForTimeout(500)

      await session.close(firstApp)
      firstApp = null

      const second = await session.launch()
      secondApp = second.app
      await waitForSessionReady(second.page)

      // Split tree + ratio restored.
      await expect
        .poll(() => getSplitLeafIds(second.page), { timeout: 30_000 })
        .toEqual([primaryId, sideId])
      const ratio = await second.page.evaluate(() => {
        const layout = window.__store?.getState().workspaceSplitLayout as
          | { ratio?: number }
          | null
          | undefined
        return layout?.ratio ?? null
      })
      expect(ratio).not.toBeNull()
      expect(Math.abs((ratio as number) - 0.3)).toBeLessThan(0.02)

      // Pane B's explorer state (expanded + custom width) restored.
      const explorerEntry = await second.page.evaluate((worktreeId) => {
        return window.__store?.getState().paneExplorerByWorktree[worktreeId] ?? null
      }, sideId)
      expect(explorerEntry).toEqual({ expanded: true, width: 320 })

      // Render-layer proof: pane B's explorer is visibly expanded post-relaunch.
      await expect(
        paneLocator(second.page, sideId).locator('[data-orca-explorer-shell]')
      ).toBeVisible({ timeout: 15_000 })
    } finally {
      for (const app of [secondApp, firstApp]) {
        if (!app) {
          continue
        }
        try {
          await session.close(app)
        } catch {
          // best-effort cleanup
        }
      }
      await session.dispose()
    }
  })

  test('removing a worktree closes its pane and purges explorer state (EDGE-01)', async ({
    orcaPage: page
  }) => {
    test.setTimeout(180_000)
    await waitForSessionReady(page)
    const primaryId = await waitForActiveWorktree(page)
    await enableSideBySideWorkspaces(page)

    const sideId = await createSecondWorktree(page, `e2e-edge01-pane-${Date.now()}`)
    await openWorktreeToTheSide(page, sideId)
    await expect.poll(() => getSplitLeafIds(page), { timeout: 30_000 }).toEqual([primaryId, sideId])

    await expandPaneExplorer(page, sideId)
    const explorerBeforeRemoval = await page.evaluate((worktreeId) => {
      return window.__store?.getState().paneExplorerByWorktree[worktreeId] ?? null
    }, sideId)
    expect(explorerBeforeRemoval).not.toBeNull()

    // Why: expanding pane B's explorer clicks inside its surface, which
    // promotes B's focus via the same pointerdown-capture handler pane
    // clicks use (only the close/maximize/restore buttons are excluded).
    // Refocus pane A before removing B so this exercises "delete a
    // background pane while staying focused on A" -- removeWorktree nulls
    // activeWorktreeId when the REMOVED worktree was the focused one (the
    // real sidebar delete flow re-focuses a successor afterward via
    // commitFocus(), which calling removeWorktree directly bypasses).
    await switchToWorktree(page, primaryId)
    await expect.poll(() => getActiveWorktreeId(page), { timeout: 10_000 }).toBe(primaryId)

    const consoleErrors: string[] = []
    page.on('pageerror', (err) => consoleErrors.push(String(err)))

    // Remove worktree B via the exact store action the sidebar "Delete"
    // flow calls (delete-worktree-flow.ts: removeWorktree(id, force)).
    const result = await page.evaluate(async (worktreeId) => {
      const store = window.__store
      if (!store) {
        throw new Error('window.__store is unavailable')
      }
      return store.getState().removeWorktree(worktreeId, false)
    }, sideId)
    expect(result.ok).toBe(true)

    // Pane closes cleanly: the split dissolves (below 2 leaves).
    await expect.poll(() => getSplitLeafIds(page), { timeout: 15_000 }).toEqual([])
    const splitLayout = await page.evaluate(
      () => window.__store?.getState().workspaceSplitLayout ?? null
    )
    expect(splitLayout).toBeNull()

    // No orphaned explorer entry for the removed worktree.
    const explorerAfterRemoval = await page.evaluate((worktreeId) => {
      return window.__store?.getState().paneExplorerByWorktree[worktreeId] ?? null
    }, sideId)
    expect(explorerAfterRemoval).toBeNull()

    expect(consoleErrors).toEqual([])

    // Pane A survives and stays functional.
    await expect(page.locator('.xterm').first()).toBeVisible({ timeout: 15_000 })
  })
})
