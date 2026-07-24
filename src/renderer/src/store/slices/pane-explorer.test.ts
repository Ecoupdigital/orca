import { describe, it, expect } from 'vitest'
import {
  PANE_EXPLORER_DEFAULT_WIDTH,
  PANE_EXPLORER_MAX_WIDTH,
  PANE_EXPLORER_MIN_WIDTH,
  clampPaneExplorerWidth,
  prunePaneExplorerState,
  sanitizePaneExplorerByWorktree,
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

  describe('sanitizePaneExplorerByWorktree', () => {
    it('returns an empty record for non-object input', () => {
      expect(sanitizePaneExplorerByWorktree(null)).toEqual({})
      expect(sanitizePaneExplorerByWorktree(undefined)).toEqual({})
      expect(sanitizePaneExplorerByWorktree('nope')).toEqual({})
      expect(sanitizePaneExplorerByWorktree(42)).toEqual({})
    })

    it('returns an empty record for array input', () => {
      expect(sanitizePaneExplorerByWorktree([{ expanded: true, width: 240 }])).toEqual({})
    })

    it('drops entries with an empty key', () => {
      const result = sanitizePaneExplorerByWorktree({ '': { expanded: true, width: 240 } })
      expect(result).toEqual({})
    })

    it('drops entries with an unsafe (prototype-pollution) key', () => {
      const result = sanitizePaneExplorerByWorktree({
        __proto__: { expanded: true, width: 240 },
        constructor: { expanded: true, width: 240 },
        prototype: { expanded: true, width: 240 },
        wt1: { expanded: true, width: 240 }
      })
      expect(result).toEqual({ wt1: { expanded: true, width: 240 } })
    })

    it('drops entries whose expanded field is not a boolean', () => {
      const result = sanitizePaneExplorerByWorktree({
        wt1: { expanded: 'yes', width: 240 }
      })
      expect(result).toEqual({})
    })

    it('drops entries whose width field is not a number', () => {
      const result = sanitizePaneExplorerByWorktree({
        wt1: { expanded: true, width: '240' }
      })
      expect(result).toEqual({})
    })

    it('drops entries that are not plain objects', () => {
      const result = sanitizePaneExplorerByWorktree({ wt1: null, wt2: 'nope', wt3: [1, 2] })
      expect(result).toEqual({})
    })

    it('clamps width on valid entries', () => {
      const result = sanitizePaneExplorerByWorktree({
        wt1: { expanded: true, width: 100 },
        wt2: { expanded: false, width: 9999 }
      })
      expect(result).toEqual({
        wt1: { expanded: true, width: PANE_EXPLORER_MIN_WIDTH },
        wt2: { expanded: false, width: PANE_EXPLORER_MAX_WIDTH }
      })
    })

    it('preserves valid entries untouched (round-trip)', () => {
      const input = {
        wt1: { expanded: true, width: 320 },
        wt2: { expanded: false, width: 160 }
      }
      expect(sanitizePaneExplorerByWorktree(input)).toEqual(input)
    })

    it('accepts a custom isSafeKey predicate', () => {
      const result = sanitizePaneExplorerByWorktree(
        { wt1: { expanded: true, width: 240 }, blocked: { expanded: true, width: 240 } },
        (key) => key !== 'blocked'
      )
      expect(result).toEqual({ wt1: { expanded: true, width: 240 } })
    })
  })
})
