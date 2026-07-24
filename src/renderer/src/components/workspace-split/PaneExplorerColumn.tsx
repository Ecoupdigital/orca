import React, { useCallback, useMemo, useRef, useState } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import FileTree from '@/components/file-tree/FileTree'
import { useAppStore } from '@/store'
import { getPaneExplorerEntry } from '@/store/slices/pane-explorer'
import { getPaneExplorerDragWidth, type PaneExplorerDragState } from './pane-explorer-column-state'
import { translate } from '@/i18n/i18n'

type PaneExplorerColumnProps = {
  worktreeId: string
}

function PaneExplorerColumn({ worktreeId }: PaneExplorerColumnProps): React.JSX.Element {
  // Why: select only this pane's raw entry (stable reference unless THIS
  // worktree's explorer state changes) instead of the whole map — keeps this
  // component from re-rendering when a sibling pane's explorer toggles/resizes.
  const rawEntry = useAppStore((s) => s.paneExplorerByWorktree[worktreeId])
  const entry = useMemo(
    () => rawEntry ?? getPaneExplorerEntry({}, worktreeId),
    [rawEntry, worktreeId]
  )
  const togglePaneExplorer = useAppStore((s) => s.togglePaneExplorer)
  const setPaneExplorerWidth = useAppStore((s) => s.setPaneExplorerWidth)

  // Why: local width during an active drag keeps resizing fluid — the store
  // (and any future persistence writer) only receives the committed width on
  // pointerup, avoiding a state update per pixel of pointer movement.
  const [dragWidth, setDragWidth] = useState<number | null>(null)
  const dragStateRef = useRef<PaneExplorerDragState | null>(null)

  const handleResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault()
      dragStateRef.current = { startClientX: event.clientX, startWidth: entry.width }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [entry.width]
  )

  const handleResizePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current
    if (!drag) {
      return
    }
    setDragWidth(getPaneExplorerDragWidth(drag, event.clientX))
  }, [])

  const handleResizePointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragStateRef.current
      if (!drag) {
        return
      }
      setPaneExplorerWidth(worktreeId, getPaneExplorerDragWidth(drag, event.clientX))
      dragStateRef.current = null
      setDragWidth(null)
      event.currentTarget.releasePointerCapture(event.pointerId)
    },
    [setPaneExplorerWidth, worktreeId]
  )

  const handleResizePointerCancel = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current) {
      return
    }
    dragStateRef.current = null
    setDragWidth(null)
    event.currentTarget.releasePointerCapture(event.pointerId)
  }, [])

  if (!entry.expanded) {
    return (
      <div
        className="flex h-full w-7 shrink-0 flex-col items-center border-r border-border bg-background pt-1.5"
        data-pane-explorer={worktreeId}
        data-pane-explorer-collapsed=""
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={translate('workspaceSplit.paneExplorer.expand', 'Expand explorer')}
              onClick={() => togglePaneExplorer(worktreeId)}
            >
              <PanelLeftOpen className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={4}>
            {translate('workspaceSplit.paneExplorer.expand', 'Expand explorer')}
          </TooltipContent>
        </Tooltip>
      </div>
    )
  }

  return (
    <div
      className="relative flex h-full shrink-0 flex-col border-r border-border bg-background"
      style={{ width: dragWidth ?? entry.width }}
      data-pane-explorer={worktreeId}
    >
      <div className="flex h-7 shrink-0 items-center justify-end border-b border-border px-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label={translate('workspaceSplit.paneExplorer.collapse', 'Collapse explorer')}
              onClick={() => togglePaneExplorer(worktreeId)}
            >
              <PanelLeftClose className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4}>
            {translate('workspaceSplit.paneExplorer.collapse', 'Collapse explorer')}
          </TooltipContent>
        </Tooltip>
      </div>
      {/* Why (PANE-03): FileTree only enters the JSX tree while expanded, so
          collapsing this column unmounts it — that unmount is what tears down
          the file-watch subscription started by useFileExplorerWatch. Loading/
          empty/error states are inherited for free from FileExplorerTreeStatus
          inside FileTree's FileExplorerBody, including first-mount latency on
          a large worktree. */}
      <div className="flex min-h-0 flex-1 flex-col">
        <FileTree worktreeId={worktreeId} />
      </div>
      <div
        className="absolute inset-y-0 right-0 w-1 cursor-col-resize hover:bg-primary/40"
        onPointerDown={handleResizePointerDown}
        onPointerMove={handleResizePointerMove}
        onPointerUp={handleResizePointerUp}
        onPointerCancel={handleResizePointerCancel}
      />
    </div>
  )
}

export default React.memo(PaneExplorerColumn)
