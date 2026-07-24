import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAppStore } from '@/store'
import { promotePaneFocusContext } from './pane-focus-context'

type KnownWorktree = { id: string; repoId: string }

const WT_A: KnownWorktree = { id: 'wt-a', repoId: 'repo-a' }
const WT_A2: KnownWorktree = { id: 'wt-a2', repoId: 'repo-a' }
const WT_B: KnownWorktree = { id: 'wt-b', repoId: 'repo-b' }
const KNOWN_WORKTREES = [WT_A, WT_A2, WT_B]

const initialActiveWorktreeId = useAppStore.getState().activeWorktreeId
const initialActiveRepoId = useAppStore.getState().activeRepoId
const initialActiveView = useAppStore.getState().activeView
const initialSetActiveWorktree = useAppStore.getState().setActiveWorktree
const initialSetActiveRepo = useAppStore.getState().setActiveRepo
const initialSetActiveView = useAppStore.getState().setActiveView
const initialGetKnownWorktreeById = useAppStore.getState().getKnownWorktreeById

afterEach(() => {
  useAppStore.setState({
    activeWorktreeId: initialActiveWorktreeId,
    activeRepoId: initialActiveRepoId,
    activeView: initialActiveView,
    setActiveWorktree: initialSetActiveWorktree,
    setActiveRepo: initialSetActiveRepo,
    setActiveView: initialSetActiveView,
    getKnownWorktreeById: initialGetKnownWorktreeById
  })
})

/** Seeds the real store with spies that mirror the minimal contract of the
 *  real actions (so post-call state reads work) while remaining assertable. */
function seedStore(overrides: { activeWorktreeId: string | null; activeRepoId: string | null }): {
  setActiveWorktree: ReturnType<typeof vi.fn>
  setActiveRepo: ReturnType<typeof vi.fn>
  setActiveView: ReturnType<typeof vi.fn>
} {
  const setActiveWorktree = vi.fn((worktreeId: string | null) => {
    useAppStore.setState({ activeWorktreeId: worktreeId })
  })
  const setActiveRepo = vi.fn((repoId: string | null) => {
    useAppStore.setState({ activeRepoId: repoId })
  })
  const setActiveView = vi.fn()
  useAppStore.setState({
    activeWorktreeId: overrides.activeWorktreeId,
    activeRepoId: overrides.activeRepoId,
    activeView: 'terminal',
    setActiveWorktree,
    setActiveRepo,
    setActiveView,
    getKnownWorktreeById: (worktreeId: string) =>
      KNOWN_WORKTREES.find((wt) => wt.id === worktreeId) as never
  })
  return { setActiveWorktree, setActiveRepo, setActiveView }
}

describe('promotePaneFocusContext', () => {
  it('promotes both activeWorktreeId and activeRepoId when the pane belongs to a different repo', () => {
    const { setActiveWorktree, setActiveRepo, setActiveView } = seedStore({
      activeWorktreeId: 'wt-a',
      activeRepoId: 'repo-a'
    })

    promotePaneFocusContext('wt-b')

    expect(setActiveWorktree).toHaveBeenCalledWith('wt-b')
    expect(setActiveRepo).toHaveBeenCalledWith('repo-b')
    expect(useAppStore.getState().activeWorktreeId).toBe('wt-b')
    expect(useAppStore.getState().activeRepoId).toBe('repo-b')
    expect(setActiveView).not.toHaveBeenCalled()
    expect(useAppStore.getState().activeView).toBe('terminal')
  })

  it('does not call setActiveRepo when the newly focused pane is in the same repo', () => {
    const { setActiveWorktree, setActiveRepo, setActiveView } = seedStore({
      activeWorktreeId: 'wt-a',
      activeRepoId: 'repo-a'
    })

    promotePaneFocusContext('wt-a2')

    expect(setActiveWorktree).toHaveBeenCalledWith('wt-a2')
    expect(setActiveRepo).not.toHaveBeenCalled()
    expect(useAppStore.getState().activeRepoId).toBe('repo-a')
    expect(setActiveView).not.toHaveBeenCalled()
  })

  it('is a no-op for setActiveWorktree and setActiveRepo when the pane is already focused', () => {
    const { setActiveWorktree, setActiveRepo, setActiveView } = seedStore({
      activeWorktreeId: 'wt-b',
      activeRepoId: 'repo-b'
    })

    promotePaneFocusContext('wt-b')

    expect(setActiveWorktree).not.toHaveBeenCalled()
    expect(setActiveRepo).not.toHaveBeenCalled()
    expect(useAppStore.getState().activeWorktreeId).toBe('wt-b')
    expect(useAppStore.getState().activeRepoId).toBe('repo-b')
    expect(setActiveView).not.toHaveBeenCalled()
  })

  it('does not throw and leaves activeRepoId unchanged for an unknown worktree', () => {
    const { setActiveRepo, setActiveView } = seedStore({
      activeWorktreeId: 'wt-a',
      activeRepoId: 'repo-a'
    })

    expect(() => promotePaneFocusContext('wt-unknown')).not.toThrow()

    expect(setActiveRepo).not.toHaveBeenCalled()
    expect(useAppStore.getState().activeRepoId).toBe('repo-a')
    expect(setActiveView).not.toHaveBeenCalled()
  })
})
