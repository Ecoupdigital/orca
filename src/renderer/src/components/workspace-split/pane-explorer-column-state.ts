import { clampPaneExplorerWidth } from '@/store/slices/pane-explorer'

export type PaneExplorerDragState = {
  startClientX: number
  startWidth: number
}

/** Width during a resize drag: start width plus pointer delta, clamped. */
export function getPaneExplorerDragWidth(drag: PaneExplorerDragState, clientX: number): number {
  return clampPaneExplorerWidth(drag.startWidth + (clientX - drag.startClientX))
}

/** Collapsed rail width in px (icon button column). */
export const PANE_EXPLORER_COLLAPSED_RAIL_WIDTH = 28
