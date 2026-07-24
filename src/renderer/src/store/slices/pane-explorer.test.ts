import { describe, it, expect } from 'vitest'
import {
  PANE_EXPLORER_DEFAULT_WIDTH,
  PANE_EXPLORER_MAX_WIDTH,
  PANE_EXPLORER_MIN_WIDTH,
  clampPaneExplorerWidth,
  prunePaneExplorerState,
  type PaneExplorerEntry
} from './pane-explorer'
import { createTestStore } from './store-test-helpers'

describe('pane-explorer slice', () => {
  describe('togglePaneExplorer', () => {
    it('creates an expanded entry at the default width when none exists', () => {
      const store = createTestStore()
      store.getState().togglePaneExplorer('wt1')
      expect(store.getState().paneExplorerByWorktree.wt1).toEqual({
        expanded: true,
        width: PANE_EXPLORER_DEFAULT_WIDTH
      })
    })

    it('toggling twice returns to collapsed and preserves a custom width', () => {
      const store = createTestStore()
      store.getState().setPaneExplorerWidth('wt1', 300)
      store.getState().togglePaneExplorer('wt1')
      expect(store.getState().paneExplorerByWorktree.wt1).toEqual({ expanded: true, width: 300 })
      store.getState().togglePaneExplorer('wt1')
      expect(store.getState().paneExplorerByWorktree.wt1).toEqual({ expanded: false, width: 300 })
    })

    it('does not disturb other panes entries', () => {
      const store = createTestStore()
      store.getState().togglePaneExplorer('wt1')
      store.getState().togglePaneExplorer('wt2')
      expect(store.getState().paneExplorerByWorktree.wt1?.expanded).toBe(true)
      expect(store.getState().paneExplorerByWorktree.wt2?.expanded).toBe(true)
    })
  })

  describe('setPaneExplorerWidth', () => {
    it.each([
      [159, PANE_EXPLORER_MIN_WIDTH],
      [PANE_EXPLORER_MIN_WIDTH, PANE_EXPLORER_MIN_WIDTH],
      [481, PANE_EXPLORER_MAX_WIDTH],
      [PANE_EXPLORER_MAX_WIDTH, PANE_EXPLORER_MAX_WIDTH],
      [Number.NaN, PANE_EXPLORER_DEFAULT_WIDTH],
      [300, 300]
    ])('clamps %d to %d', (input, expected) => {
      const store = createTestStore()
      store.getState().setPaneExplorerWidth('wt1', input)
      expect(store.getState().paneExplorerByWorktree.wt1?.width).toBe(expected)
    })

    it('preserves expanded state while resizing', () => {
      const store = createTestStore()
      store.getState().togglePaneExplorer('wt1')
      store.getState().setPaneExplorerWidth('wt1', 320)
      expect(store.getState().paneExplorerByWorktree.wt1).toEqual({ expanded: true, width: 320 })
    })
  })

  describe('clampPaneExplorerWidth', () => {
    it('rounds fractional widths', () => {
      expect(clampPaneExplorerWidth(200.6)).toBe(201)
    })
  })

  describe('prunePaneExplorerState', () => {
    it('removes only the ids in the removed set', () => {
      const byWorktree: Record<string, PaneExplorerEntry> = {
        wt1: { expanded: true, width: 240 },
        wt2: { expanded: false, width: 300 },
        wt3: { expanded: true, width: 160 }
      }
      const result = prunePaneExplorerState(
        { paneExplorerByWorktree: byWorktree },
        new Set(['wt2'])
      )
      expect(result.paneExplorerByWorktree).toEqual({
        wt1: { expanded: true, width: 240 },
        wt3: { expanded: true, width: 160 }
      })
    })

    it('returns an identical reference when the removed set is empty', () => {
      const byWorktree: Record<string, PaneExplorerEntry> = {
        wt1: { expanded: true, width: 240 }
      }
      const result = prunePaneExplorerState({ paneExplorerByWorktree: byWorktree }, new Set())
      expect(result.paneExplorerByWorktree).toBe(byWorktree)
    })

    it('returns an identical reference when no entry matches the removed ids', () => {
      const byWorktree: Record<string, PaneExplorerEntry> = {
        wt1: { expanded: true, width: 240 }
      }
      const result = prunePaneExplorerState(
        { paneExplorerByWorktree: byWorktree },
        new Set(['wt-unrelated'])
      )
      expect(result.paneExplorerByWorktree).toBe(byWorktree)
    })
  })
})
