# PROJECT — Orca (fork EcoUp)

## O que é isso
IDE Electron open-source (upstream stablyai/orca) forkeado pela EcoUp para builds e features próprias (side-by-side panes, explorer por pane, CI ecoup-*).

## Objetivo ativo
Investigar e documentar causa de terminais que duplicam ou abrem vazios ao trocar de terminal/projeto. Correção fica para fase posterior.

## Requisitos
### Validados (código existente)
- Multi-worktree, multi-terminal PTY, SSH/WSL, side-by-side panes (experimental/EcoUp)

### Ativos (esta investigação)
- [ ] Reproduzir mentalmente / no código o path de "click outro terminal"
- [ ] Reproduzir mentalmente / no código o path de "troca de projeto"
- [ ] Listar pontos que criam terminal/sessão sem intent explícito do user
- [ ] Documentar causa raiz candidata com arquivos/linhas
- [ ] NÃO aplicar patch de correção
