# Debug: terminais duplicados / vazios ao trocar foco ou projeto

**Status:** investigação (sem fix)  
**Branch:** `ecoup` @ HEAD  
**Data:** 2026-08-03  
**Modo:** only investigate

---

## Sintomas (usuário)

1. Estando num projeto/terminal, **clica em outro terminal** → às vezes **duplica** ou abre **terminal vazio**.
2. **Troca de projetos** (worktree/repo na sidebar) → mesmo tipo de lixo (terminal extra / vazio).

Esperado: foco só muda; projeto troca e mostra as tabs que já existiam, sem spawn fantasma.

---

## Modelo mental do lifecycle de terminal

```
Sidebar / pane click / IPC
        │
        ▼
┌───────────────────────────┐
│ activateAndRevealWorktree │  ← troca de projeto (sidebar)
│  • setActiveRepo          │
│  • setActiveWorktree      │
│  • ensureWorktreeHas…     │  ← CREATE se renderableTabCount === 0
└───────────────────────────┘

Side-by-side pane click (EcoUp #10)
        │
        ▼
┌───────────────────────────┐
│ promotePaneFocusContext   │  Terminal.tsx onPointerDown/FocusCapture
│  • setActiveWorktree only │  ← NÃO chama ensure…, MAS muda activeWorktreeId
└───────────────────────────┘
        │
        ▼
┌───────────────────────────┐
│ Terminal.tsx useEffect    │  deps: [workspaceSessionReady, activeWorktreeId, …]
│  "Auto-create first tab"  │
│  se renderableTabCount==0 │  ← CREATE tab vazia (pendingActivationSpawn)
│  → createTab(...)         │
└───────────────────────────┘
```

Critério de “precisa de terminal”:

```ts
// src/renderer/src/components/terminal/initial-terminal.ts
shouldAutoCreateInitialTerminal(renderableTabCount) // true IFF count === 0
```

`renderableTabCount` vem de `reconcileWorktreeTabModel`: só conta tabs **unificadas** cuja entity ainda está “viva” em `tabsByWorktree` (e não é orphan). Terminal unificado sem row runtime / sem PTY reconnectável **não conta**.

---

## Hipóteses (ranqueadas)

### H1 — PRIMARY: auto-create em `Terminal.tsx` reage a todo `activeWorktreeId` change

**Arquivo:** `src/renderer/src/components/Terminal.tsx` ~1235–1254

```ts
// Auto-create first tab when worktree activates
useEffect(() => {
  if (!workspaceSessionReady || !activeWorktreeId) return
  if (isWebRuntimeSessionActive(...)) return
  const { renderableTabCount } = reconcileWorktreeTabModel(activeWorktreeId)
  if (!shouldAutoCreateInitialTerminal(renderableTabCount)) return
  createTab(activeWorktreeId, undefined, undefined, { pendingActivationSpawn: true })
}, [workspaceSessionReady, activeWorktreeId, createTab, reconcileWorktreeTabModel])
```

**Por que combina com o sintoma:**
- Qualquer caminho que mude `activeWorktreeId` re-dispara o effect.
- Se o reconcile devolver **0 renderable** (falso negativo), nasce um **Terminal N vazio** (shell novo, sem agente).
- Isso parece “duplicou” se tabs antigas ainda estão no store/chrome mas não entraram no count, ou “vazio” se o spawn é shell limpo.

**Gatilhos de `activeWorktreeId`:**
| Gatilho | Path |
|--------|------|
| Troca de projeto (sidebar) | `activateWorktreeFromSidebar` → `activateAndRevealWorktree` → `setActiveWorktree` |
| Click em outro pane side-by-side | `promotePaneFocusContext` → `setActiveWorktree` (EcoUp #10) |
| Ativação genérica | dezenas de callers de `activateAndRevealWorktree` |

---

### H2 — PRIMARY (EcoUp amplifica H1): pane focus promove worktree global

**Arquivos:**
- `src/renderer/src/lib/pane-focus-context.ts` — `promotePaneFocusContext`
- `src/renderer/src/components/Terminal.tsx` ~2517–2537 — `onPointerDownCapture` / `onFocusCapture`

```ts
export function promotePaneFocusContext(worktreeId: string): void {
  const state = useAppStore.getState()
  if (state.activeWorktreeId !== worktreeId) {
    state.setActiveWorktree(worktreeId) // ← só isto
  }
  // setActiveRepo se repo diferente; NUNCA setActiveView
}
```

Feature EcoUp (`1ff55375f` / PR #10): “global repo/worktree context follows focused pane”.

**Efeito colateral não coberto pelos e2e de CTX-01/02/04:**  
Os e2e (`tests/e2e/pane-focus-context.spec.ts`) validam `activeWorktreeId`/`activeRepoId` e view, **não** assertam “não criar terminal extra” no focus.  
Logo: clique no pane B = mudança de worktree global = H1 pode spawnar se count==0.

Com flag `experimentalSideBySideWorkspaces` OFF, `workspacePaneControls` é null e o promote **não roda**. Sintoma de “clicar em outro terminal” via panes some. Troca de projeto (sidebar) ainda passa por H1+H3.

---

### H3 — SECONDARY: double ensure na troca de projeto

**Arquivo:** `src/renderer/src/lib/worktree-activation.ts` ~344–352 + 431+

```ts
// activateAndRevealWorktree
state.setActiveWorktree(worktreeId)
const primaryTabId = ensureWorktreeHasInitialTerminal(...) // createTab se count==0
```

Depois o React effect (H1) roda de novo com o mesmo critério.

Em condições normais o 1º create já deixa count≥1 e o effect no-op.  
**Race / falso zero:** se o 1º path retorna cedo (web runtime mirror, defaultTabs race, reconcile inconsistente) e o effect ainda vê 0, **dois** creates.  
Também: `ensure…` + effect = mesma política “always have a surface”, mas sem dedupe por token de ativação.

---

### H4 — SECONDARY: `renderableTabCount === 0` com tabs “fantasma”

**Arquivos:**
- `reconcileWorktreeTabModel` — `src/renderer/src/store/slices/tabs.ts` ~1780+
- `getOrphanTerminalIds` — `terminal-orphan-helpers.ts`

Tab terminal só é renderable se:
- está em `unifiedTabs` (ou é legacy recuperável com PTY reconnectável), e
- `entityId` ∈ `tabsByWorktree` e não é orphan.

Cenários de falso zero:
1. Runtime tabs órfãs (sem unified + sem PTY) → varridas; se unificadas também sumiram do count, create novo.
2. Tabs só em layout/chrome mas PTY morto sem reconnect maps → não renderable → create **além** das rows mortas (duplicata visual se UI ainda listar algo).
3. Hidratação de sessão incompleta no instante do activate (tabs ainda não no store) → create prematuro; depois hydrate traz as antigas → **duplicatas reais**.

---

### H5 — TERTIARY: remount por generation bump (parece terminal “vazio”)

**Arquivo:** `setActiveWorktree` em `worktrees.ts` ~4606–4635

Se **todas** as tabs do worktree estão sem live PTY (`allDead`), activation bumpa `generation` em todas e marca `pendingActivationSpawn`.  
Remount re-spawna shells → visual de “terminais novos/vazios” sem necessariamente aumentar a contagem de tabs.

Isso é recovery intencional de PTY morta, mas no uso diário (sleep/SSH/WSL) parece o bug do usuário.

---

### H6 — descartada como causa principal: createTab no click de tab same-worktree

Click em outra tab **do mesmo** worktree usa `activateTab` / tab-strip pointer activation e **não** muda `activeWorktreeId`.  
H1 não dispara.  
A menos que o usuário esteja em side-by-side (H2) ou o “outro terminal” seja de outro projeto/pane.

---

## Causa raiz candidata (síntese)

| Rank | Causa | Confiança |
|------|--------|-----------|
| 1 | **Auto-create em `Terminal.tsx` acionado por mudança de `activeWorktreeId`**, com critério frágil `renderableTabCount === 0` | Alta (código + call graph) |
| 2 | **EcoUp `promotePaneFocusContext`** faz todo click de pane virar worktree activation → reusa (1) sem passar por `activateAndReveal` | Alta no path side-by-side |
| 3 | **Duplo ensure** (activation helper + effect) sob race/hidratação | Média |
| 4 | **Falso zero no reconcile / orphans / session restore** | Média (precisa repro com state dump) |
| 5 | **Generation bump allDead** (parece vazio, sem duplicar tab id) | Média para “vazio” |

Não há evidência de um único bug “só EcoUp” isolado: o auto-create é **upstream**. O fork **amplifica** via pane-focus (#10) e side-by-side (#9439 merge).

---

## Repro steps inferidos do código

### A — Troca de projeto (mais provável de repro)

1. Abrir worktree A com ≥1 terminal “vivo”.
2. Abrir/visitar worktree B; fechar todos os terminais **ou** deixar tabs só “mortas”/órfãs (ou ativar B antes da session hydrate terminar).
3. Clicar de A → B na sidebar (`activateWorktreeFromSidebar`).
4. Observar: `ensureWorktreeHasInitialTerminal` e/ou effect criam `Terminal N` vazio; se hydrate atrasa, tabs antigas reaparecem → **duplicata**.

### B — Side-by-side + click em outro pane

1. `experimentalSideBySideWorkspaces = true`.
2. Dois panes (dois worktrees/repos) abertos.
3. Pane B com surface sem tabs renderable (ou race de mount).
4. Click no pane B (qualquer área, inclusive terminal).
5. `promotePaneFocusContext` → `setActiveWorktree(B)` → effect auto-create.

### C — “Vazio” sem tab extra

1. Worktree com tabs cujas PTYs morreram (sleep, crash, SSH drop).
2. Reativar worktree.
3. `allDead` → generation++ → remount/spawn shells limpos.

---

## O que um fix deveria tocar (NÃO implementado)

1. **Dedup de auto-create:** token por worktree (`defaultTerminalTabsAppliedByWorktreeId` / `everActivated` / “user closed last tab”) no effect de `Terminal.tsx`, alinhado com o comentário *“without recreating one after the user closes the last visible tab”* (hoje o effect **não** consulta se o user esvaziou de propósito vs never-visited).
2. **`promotePaneFocusContext`:** não deve disparar o mesmo “ensure surface” que activation de sidebar; se precisar de surface, só em first-ever visit, não em re-focus.
3. **Aguardar hydrate/session ready por worktree** antes de `shouldAutoCreateInitialTerminal`.
4. **E2E negativo:** pane focus CTX + project switch assert `tabsByWorktree[id].length` estável (sem +1 fantasma).
5. Cuidado com `ensureWorktreeHasInitialTerminal` + effect: um único owner de “seed terminal”.

Áreas sensíveis: SSH reconnect (#9911), web mirror session tabs, sleep/wake respawn, side-by-side layout.

---

## Evidências (paths)

| Peça | Path |
|------|------|
| Auto-create effect | `src/renderer/src/components/Terminal.tsx:1235-1254` |
| Critério count==0 | `src/renderer/src/components/terminal/initial-terminal.ts` |
| Activation + ensure | `src/renderer/src/lib/worktree-activation.ts:281-381, 431+` |
| Sidebar project switch | `src/renderer/src/lib/sidebar-worktree-activation.ts` |
| Pane focus EcoUp | `src/renderer/src/lib/pane-focus-context.ts` + wire em `Terminal.tsx:2517-2537` |
| setActiveWorktree / allDead | `src/renderer/src/store/slices/worktrees.ts:4426+` |
| createTab | `src/renderer/src/store/slices/terminals.ts:919+` |
| Reconcile / orphan | `tabs.ts:1780+`, `terminal-orphan-helpers.ts` |
| E2e CTX (sem assert de tabs) | `tests/e2e/pane-focus-context.spec.ts` |
| Commits EcoUp | `1ff55375f` pane-focus, `07af888a6` pane-persistence, merge #9439 side-by-side |

---

## Próximos passos (quando for corrigir)

1. Repro instrumentado: logar em `createTab` caller stack + `activeWorktreeId` + `renderableTabCount` (temporário).
2. Dump store no momento do bug: `tabsByWorktree`, `unifiedTabsByWorktree`, `ptyIdsByTabId`, `everActivatedWorktreeIds`.
3. Fix mínimo + e2e “focus pane / switch project não incrementa tabs”.
4. **Não** misturar com mais features de pane-explorer até estabilizar.

## ROOT CAUSE FOUND (candidata confirmada por código; falta repro runtime com state dump)

**Mecanismo principal:** criação automática de terminal quando `activeWorktreeId` muda e `reconcileWorktreeTabModel` reporta 0 tabs renderable (`Terminal.tsx` + `shouldAutoCreateInitialTerminal`), amplificado na troca de projeto por `ensureWorktreeHasInitialTerminal` e no side-by-side pelo `promotePaneFocusContext` do fork EcoUp.

---

## FIX APPLIED (2026-08-03)

### Change
- `shouldAutoCreateInitialTerminal` now accepts surface footprint + `forceIfEmpty`.
- Prior tabs/groups/layout/defaultTabs → **no reseed** on empty renderable count.
- `Terminal.tsx` auto-create effect and `ensureWorktreeHasInitialTerminal` both use the snapshot after reconcile.
- Setup/startup/default-tabs intent still forces a host when no runtime row exists.

### Files
- `src/renderer/src/components/terminal/initial-terminal.ts`
- `src/renderer/src/components/terminal/initial-terminal.test.ts`
- `src/renderer/src/components/Terminal.tsx`
- `src/renderer/src/lib/worktree-activation.ts`
- `src/renderer/src/lib/worktree-activation.test.ts`

### Tests
`pnpm exec vitest run ... initial-terminal.test.ts worktree-activation.test.ts` → 42 passed.
