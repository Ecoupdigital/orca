import React, { useMemo } from 'react'
import { FileTreeWorktreeContext } from './file-tree-context'
import { FileExplorerBody } from '@/components/right-sidebar/FileExplorer'

type FileTreeProps = {
  worktreeId: string
}

/** File tree bound to one worktree (pane explorer). The right-sidebar
 *  explorer renders FileExplorerBody without a provider and keeps
 *  following the global active worktree. */
function FileTree({ worktreeId }: FileTreeProps): React.JSX.Element {
  const ctxValue = useMemo(() => ({ worktreeId }), [worktreeId])
  return (
    <FileTreeWorktreeContext.Provider value={ctxValue}>
      <FileExplorerBody />
    </FileTreeWorktreeContext.Provider>
  )
}

export default React.memo(FileTree)
