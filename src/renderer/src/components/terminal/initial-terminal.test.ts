import { describe, expect, it } from 'vitest'
import {
  hasPriorInitialTerminalSurface,
  readInitialTerminalSurfaceSnapshot,
  shouldAutoCreateInitialTerminal,
  type InitialTerminalSurfaceSnapshot
} from './initial-terminal'

const virginSurface: InitialTerminalSurfaceSnapshot = {
  runtimeTerminalCount: 0,
  unifiedTabCount: 0,
  groupCount: 0,
  hasLayout: false,
  defaultTerminalTabsApplied: false
}

describe('shouldAutoCreateInitialTerminal', () => {
  it('creates a terminal when the tab-group model has no renderable tabs (legacy count-only)', () => {
    expect(shouldAutoCreateInitialTerminal(0)).toBe(true)
  })

  it('does not create a terminal when the tab-group model already has content', () => {
    expect(shouldAutoCreateInitialTerminal(1)).toBe(false)
    expect(shouldAutoCreateInitialTerminal(2)).toBe(false)
  })

  it('seeds a virgin worktree with zero renderable tabs', () => {
    expect(shouldAutoCreateInitialTerminal(0, { surface: virginSurface })).toBe(true)
  })

  it('does not reseed when runtime terminal rows exist but are not renderable', () => {
    expect(
      shouldAutoCreateInitialTerminal(0, {
        surface: { ...virginSurface, runtimeTerminalCount: 2 }
      })
    ).toBe(false)
  })

  it('does not reseed when unified tabs / groups / layout remain after an empty close', () => {
    expect(
      shouldAutoCreateInitialTerminal(0, {
        surface: { ...virginSurface, unifiedTabCount: 1 }
      })
    ).toBe(false)
    expect(
      shouldAutoCreateInitialTerminal(0, {
        surface: { ...virginSurface, groupCount: 1 }
      })
    ).toBe(false)
    expect(
      shouldAutoCreateInitialTerminal(0, {
        surface: { ...virginSurface, hasLayout: true }
      })
    ).toBe(false)
    expect(
      shouldAutoCreateInitialTerminal(0, {
        surface: { ...virginSurface, defaultTerminalTabsApplied: true }
      })
    ).toBe(false)
  })

  it('forceIfEmpty still seeds when activation intent needs a host and surface is empty', () => {
    expect(
      shouldAutoCreateInitialTerminal(0, {
        surface: virginSurface,
        forceIfEmpty: true
      })
    ).toBe(true)
  })

  it('forceIfEmpty refuses to mint a second shell when a runtime row already exists', () => {
    expect(
      shouldAutoCreateInitialTerminal(0, {
        surface: { ...virginSurface, runtimeTerminalCount: 1 },
        forceIfEmpty: true
      })
    ).toBe(false)
  })
})

describe('readInitialTerminalSurfaceSnapshot', () => {
  it('reads per-worktree footprint from store-shaped state', () => {
    const snapshot = readInitialTerminalSurfaceSnapshot(
      {
        tabsByWorktree: { 'wt-a': [{ id: 't1' }], 'wt-b': [] },
        unifiedTabsByWorktree: { 'wt-a': [{ id: 'u1' }] },
        groupsByWorktree: { 'wt-a': [{ id: 'g1' }] },
        layoutByWorktree: { 'wt-a': { type: 'leaf', groupId: 'g1' } },
        defaultTerminalTabsAppliedByWorktreeId: { 'wt-a': true }
      },
      'wt-a'
    )
    expect(snapshot).toEqual({
      runtimeTerminalCount: 1,
      unifiedTabCount: 1,
      groupCount: 1,
      hasLayout: true,
      defaultTerminalTabsApplied: true
    })
    expect(hasPriorInitialTerminalSurface(snapshot)).toBe(true)
    expect(hasPriorInitialTerminalSurface(readInitialTerminalSurfaceSnapshot({}, 'missing'))).toBe(
      false
    )
  })
})
