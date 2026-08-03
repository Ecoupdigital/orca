# STATE

## Projeto
Orca fork EcoUp — bug terminais duplicados/vazios.

## Status
FIX aplicado (sem commit automático pedido).

## Última atividade
2026-08-03 — fix: auto-create de terminal respeita footprint (tabs/groups/layout); não reseed em project switch / pane focus.

## Decisões
- Critério compartilhado em `shouldAutoCreateInitialTerminal` + surface snapshot.
- forceIfEmpty preserva setup/startup.

## Próximo
Validar no app (trocar projeto + side-by-side). Commit se ok.
