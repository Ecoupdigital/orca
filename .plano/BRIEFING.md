# BRIEFING — Investigação: terminais duplicados / vazios ao trocar foco ou projeto

## Modo
Brownfield | Investigação only (NÃO corrigir nesta etapa)

## Problema
No fork EcoUp do Orca (branch `ecoup`), ao:
1. Clicar em outro terminal (troca de foco entre terminais), e/ou
2. Trocar de projeto/worktree,

às vezes:
- terminais **duplicam**, ou
- abre um **terminal vazio** (sem sessão/agente/shell útil).

## Objetivo desta rodada
- Mapear o fluxo de foco de terminal e troca de projeto/worktree
- Formular hipóteses com evidência no código
- Identificar causa raiz provável (ou top candidatas)
- **Não aplicar fix**

## Contexto de produto
- Fork: Ecoupdigital/orca, branch `ecoup`
- Features EcoUp recentes: side-by-side panes, pane-explorer, pane-focus context, pane persistence
- Possível interação entre panes e lifecycle de terminal/sessão

## Entrega
`.plano/debug/terminal-duplication-on-switch.md` com hipóteses, evidências, causa(s) candidata(s) e próximos passos de fix (sem implementar).
