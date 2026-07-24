import React from 'react'
import { FileExplorerViewSwitch } from './FileExplorerViewSwitch'
import type { RightSidebarExplorerView } from '../../../../shared/types'

type FileExplorerQueryStripProps = {
  view: RightSidebarExplorerView
  onSelectView: (view: RightSidebarExplorerView) => void
  children: React.ReactNode
  /** Why: pane-mode explorers only support the Files view, so the Names/Contents
   *  switch has nothing to switch between and stays hidden. */
  hideViewSwitch?: boolean
}

export function FileExplorerQueryStrip({
  view,
  onSelectView,
  children,
  hideViewSwitch = false
}: FileExplorerQueryStripProps): React.JSX.Element {
  return (
    <div className="border-b border-border px-2 py-1.5">
      {/* Why: show the active query field first; the Contents/Names switch sits
         underneath so it reads as choosing the mode for the field above. */}
      <div className="flex flex-col gap-1">
        {children}
        {hideViewSwitch ? null : <FileExplorerViewSwitch view={view} onSelectView={onSelectView} />}
      </div>
    </div>
  )
}
