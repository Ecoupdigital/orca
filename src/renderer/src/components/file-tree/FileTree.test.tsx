// @vitest-environment happy-dom

import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DirEntry, Repo, Worktree } from '../../../../shared/types'
import { useAppStore } from '@/store'
import type * as RuntimeFileClient from '@/runtime/runtime-file-client'
import { TooltipProvider } from '@/components/ui/tooltip'
import { FileExplorerBody } from '@/components/right-sidebar/FileExplorer'
import FileTree from './FileTree'

// Why: the file tree is fully virtualized (@tanstack/react-virtual), which
// measures real layout to decide the visible range. happy-dom reports a
// zero-size scroll container, so the real virtualizer would render nothing;
// mount every row instead, matching the pattern used by other virtualized
// list tests in this repo (see WorktreeList.card-memo-stability.test.tsx).
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 26,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({ index, key: index, start: index * 26 })),
    measureElement: () => {},
    scrollToIndex: () => {}
  })
}))

const readRuntimeDirectoryMock = vi.hoisted(() => vi.fn())

vi.mock('@/runtime/runtime-file-client', async (importOriginal) => {
  const actual = await importOriginal<typeof RuntimeFileClient>()
  return {
    ...actual,
    readRuntimeDirectory: readRuntimeDirectoryMock
  }
})

vi.mock('@/runtime/runtime-git-client', () => ({
  getRuntimeGitIgnoredPaths: vi.fn().mockResolvedValue([])
}))

vi.mock('@/components/confirmation-dialog', () => ({
  useConfirmationDialog: () => vi.fn().mockResolvedValue(true)
}))

const initialAppState = useAppStore.getInitialState()

function makeRepo(overrides: Partial<Repo> = {}): Repo {
  return {
    id: 'repo-a',
    path: '/repo-a',
    displayName: 'Repo A',
    badgeColor: '#000',
    addedAt: 0,
    ...overrides
  }
}

function makeWorktree(overrides: Partial<Worktree> = {}): Worktree {
  return {
    id: 'repo-a::/repo-a',
    repoId: 'repo-a',
    path: '/repo-a',
    // Why: pins operation-owner resolution to 'local' deterministically
    // (file-explorer-operation-owner.ts), instead of depending on the
    // store's legacy-local heuristic (runtimeEnvironmentCatalogHydrated),
    // which defaults to false and would resolve as 'unresolved'.
    hostId: 'local',
    head: 'abc123',
    branch: 'refs/heads/main',
    isBare: false,
    isMainWorktree: true,
    displayName: 'repo-a',
    comment: '',
    linkedIssue: null,
    linkedPR: null,
    linkedLinearIssue: null,
    isArchived: false,
    isUnread: false,
    isPinned: false,
    sortOrder: 0,
    lastActivityAt: 0,
    ...overrides
  }
}

const repoA = makeRepo({ id: 'repo-a', path: '/repo-a', displayName: 'Repo A' })
const worktreeA = makeWorktree({
  id: 'wt-a',
  repoId: 'repo-a',
  path: '/repo-a',
  displayName: 'wt-a'
})
const repoB = makeRepo({ id: 'repo-b', path: '/repo-b', displayName: 'Repo B' })
const worktreeB = makeWorktree({
  id: 'wt-b',
  repoId: 'repo-b',
  path: '/repo-b',
  displayName: 'wt-b'
})

function entry(name: string): DirEntry {
  return { name, isDirectory: false, isSymlink: false }
}

function renderWithProviders(ui: React.ReactElement): ReturnType<typeof render> {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

beforeEach(() => {
  useAppStore.setState(initialAppState, true)
  useAppStore.setState({
    repos: [repoA, repoB],
    worktreesByRepo: { 'repo-a': [worktreeA], 'repo-b': [worktreeB] },
    activeWorktreeId: worktreeA.id,
    // Why: only the no-provider (global explorer) path gates visibility on
    // the right sidebar being open; pane mode ignores this gate entirely
    // (that is what the fallback test below exercises). Open it here so the
    // fallback scenario mounts the same way the real right sidebar would.
    rightSidebarOpen: true
  })
  readRuntimeDirectoryMock.mockReset().mockImplementation(async () => [entry('index.ts')])
  // Why: local file-tree watchers subscribe directly to the Electron fs bus
  // (no runtime environment in play for this fixture); stub the two watcher
  // entry points hit unconditionally on mount so they don't throw on the
  // missing window.api in this DOM-only test environment.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test-only window.api shim
  ;(window as any).api = {
    fs: { onFsChanged: vi.fn(() => () => {}) },
    ui: { onFileDrop: vi.fn(() => () => {}) }
  }
})

afterEach(() => {
  document.body.replaceChildren()
  useAppStore.setState(initialAppState, true)
})

describe('FileTree(worktreeId)', () => {
  it('mounts the tree for the pane worktree, not the global active worktree', async () => {
    // wt-a is the global active worktree; the pane asks for wt-b.
    renderWithProviders(<FileTree worktreeId={worktreeB.id} />)

    await waitFor(() => expect(readRuntimeDirectoryMock).toHaveBeenCalled())

    expect(readRuntimeDirectoryMock).toHaveBeenCalledWith(
      expect.objectContaining({ worktreeId: worktreeB.id, worktreePath: worktreeB.path }),
      expect.any(String)
    )
    expect(readRuntimeDirectoryMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ worktreeId: worktreeA.id }),
      expect.any(String)
    )
  })

  it('opens a file from the pane tree with the pane worktreeId, not the global active one', async () => {
    const openFileMock = vi.fn()
    useAppStore.setState({ openFile: openFileMock })

    renderWithProviders(<FileTree worktreeId={worktreeB.id} />)

    const row = await screen.findByText('index.ts')
    const button = row.closest('button[data-file-explorer-row]')
    expect(button).not.toBeNull()

    await act(async () => {
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    await waitFor(() => expect(openFileMock).toHaveBeenCalled())
    expect(openFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        filePath: '/repo-b/index.ts',
        relativePath: 'index.ts',
        worktreeId: worktreeB.id
      }),
      expect.anything()
    )
  })

  it('falls back to the global active worktree when rendered without a provider', async () => {
    renderWithProviders(<FileExplorerBody />)

    await waitFor(() => expect(readRuntimeDirectoryMock).toHaveBeenCalled())

    expect(readRuntimeDirectoryMock).toHaveBeenCalledWith(
      expect.objectContaining({ worktreeId: worktreeA.id, worktreePath: worktreeA.path }),
      expect.any(String)
    )
    expect(readRuntimeDirectoryMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ worktreeId: worktreeB.id }),
      expect.any(String)
    )
  })
})
