// @vitest-environment happy-dom

import { useMemo, type ReactNode } from 'react'
import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useAppStore } from '@/store'
import {
  FileTreeWorktreeContext,
  useFileTreeWorktreeId,
  useIsFileTreePaneMode
} from './file-tree-context'

const initialAppState = useAppStore.getInitialState()

function withProvider(worktreeId: string) {
  return function Wrapper({ children }: { children: ReactNode }): React.JSX.Element {
    // Why: worktreeId is a closure value from withProvider's outer scope, not
    // a prop/state of Wrapper, so it is stable across re-renders and does not
    // belong in the dependency array.
    const value = useMemo(() => ({ worktreeId }), [])
    return (
      <FileTreeWorktreeContext.Provider value={value}>{children}</FileTreeWorktreeContext.Provider>
    )
  }
}

beforeEach(() => {
  useAppStore.setState(initialAppState, true)
})

afterEach(() => {
  useAppStore.setState(initialAppState, true)
})

describe('useFileTreeWorktreeId', () => {
  it('falls back to the global active worktree without a provider', () => {
    useAppStore.setState({ activeWorktreeId: 'wt-global' })

    const { result } = renderHook(() => useFileTreeWorktreeId())

    expect(result.current).toBe('wt-global')
  })

  it('returns the provider worktreeId even when the global active worktree differs', () => {
    useAppStore.setState({ activeWorktreeId: 'wt-outro' })

    const { result } = renderHook(() => useFileTreeWorktreeId(), {
      wrapper: withProvider('wt-pane')
    })

    expect(result.current).toBe('wt-pane')
  })
})

describe('useIsFileTreePaneMode', () => {
  it('is false without a provider (global right-sidebar explorer)', () => {
    const { result } = renderHook(() => useIsFileTreePaneMode())

    expect(result.current).toBe(false)
  })

  it('is true with a provider (pane explorer)', () => {
    const { result } = renderHook(() => useIsFileTreePaneMode(), {
      wrapper: withProvider('wt-pane')
    })

    expect(result.current).toBe(true)
  })
})
