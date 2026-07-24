import { describe, it, expect } from 'vitest'
import {
  PANE_EXPLORER_COLLAPSED_RAIL_WIDTH,
  getPaneExplorerDragWidth,
  type PaneExplorerDragState
} from './pane-explorer-column-state'
import { PANE_EXPLORER_MAX_WIDTH, PANE_EXPLORER_MIN_WIDTH } from '@/store/slices/pane-explorer'

describe('getPaneExplorerDragWidth', () => {
  const drag: PaneExplorerDragState = { startClientX: 500, startWidth: 240 }

  it('applies a positive delta', () => {
    expect(getPaneExplorerDragWidth(drag, 560)).toBe(300)
  })

  it('applies a negative delta', () => {
    expect(getPaneExplorerDragWidth(drag, 460)).toBe(200)
  })

  it('clamps to the max width on a large positive delta', () => {
    expect(getPaneExplorerDragWidth(drag, 500 + 1000)).toBe(PANE_EXPLORER_MAX_WIDTH)
  })

  it('clamps to the min width on a large negative delta', () => {
    expect(getPaneExplorerDragWidth(drag, 500 - 1000)).toBe(PANE_EXPLORER_MIN_WIDTH)
  })

  it('returns the start width when clientX is unchanged', () => {
    expect(getPaneExplorerDragWidth(drag, 500)).toBe(240)
  })
})

describe('PANE_EXPLORER_COLLAPSED_RAIL_WIDTH', () => {
  it('is a fixed 28px rail', () => {
    expect(PANE_EXPLORER_COLLAPSED_RAIL_WIDTH).toBe(28)
  })
})
