# ★ CONTINUAR AQUI — P1 Fast (checkpoint 19/06/2026 noite)

Gatilho do Flávio pra retomar: **"RETOMAR CHECKLIST P1 FAST"** (ou "voltei").
Ao retomar: ler ESTE arquivo + a memória `p1-fast-checklist-pista-2026-06-19` e `p1-fast-cerebro-painel-tripa-2026-06-19`. Log completo: `.claude-exec/ANALISE-tripa-plano-coach-preditivo-2026-06-19.md`.

## PRÓXIMO PASSO EXATO (é aqui que paramos)
**Checklist de Pista — Etapa 2: as TELAS no app (iOS SwiftUI).**
- Construir, no padrão do **Estoque** (`ios/p1fast-ios/Sources/Views/EstoqueViews.swift` + `Sources/Persistence/EstoqueRepository.swift`):
  1. Tela pra ver/editar a **lista padrão** (adicionar item, **desativar**/reativar, mudar responsável e obrigatório/adicional).
  2. Tela pra **ticar** itens no evento (saída/chegada), por papel.
  3. Entrada no **Hub** (`GaragemView.swift`, sub-aba como Estoque).
  4. `ChecklistRepository` (CRUD + bootstrap + enfileira no SyncQueue), espelhando `EstoqueRepository`.
- Depois: empacotar e **instalar no iPhone** (Team `K3MU9U9952`; comandos no log/STATUS.md).
- Etapa 3 = tabela espelho na nuvem + sync (SÓ produção com "MIGRAR PARA PRODUÇÃO").
- Etapa 4 = ligar o componente do Command Box no checklist real (espelho ao vivo dos pendentes).

## JÁ FEITO E PROVADO (não refazer)
- **Checklist Etapa 1 (base no app):** `Models.swift` (`ChecklistItem`+`ChecklistTique`), `Migrations.swift` **v35_checklist_pista**, `ChecklistCatalogo.swift` (lista padrão 11 saída + 8 chegada + bootstrap + pendentes). Confirmar com: `cd ios/p1fast-core && swift run p1fast-smoke` → deve dar **552 ok / 1 fail** (a 1 falha é PRÉ-EXISTENTE: PERSIST-03 `evento_pendencias_extra`, não é nossa). Papéis já existem (`pessoa_papeis`).
- **Cérebro do painel (tripa Plano/Coach/Preditivo) + Velocímetro:** na tela OFICIAL servida no **8078**. Voltas/Ritmo/Coach/Meta/Velocímetro = reais; ao vivo-primeiro (ouve cockpit-bubi-live, gravado de referência). Módulos `web/command-box/cerebro/*` + smokes (todos EXIT=0). Lista padrão do checklist aprovada no desenho `_design-reference/checklist-pista-DESIGN-2026-06-19.html`.

## REGRAS DURAS (não esquecer)
- **NÃO mexer no formato** do Command Box (ordem do Flávio). Só preencher campos / tirar cinza.
- Abrir o Command Box **SÓ no endereço 8078** (o layout salvo do Flávio mora lá; abrir noutra porta desconfigura).
- **Não tocar produção** sem a frase "MIGRAR PARA PRODUÇÃO". Nuvem é única (produção).
- Validar no navegador / pelo teste automático **antes** de chamar o Flávio.

## PENDÊNCIAS abertas (decisão do Flávio, não bloqueiam a Etapa 2)
- Regra de **pontuação da volta** (0-100) e % da lição do Coach — sem isso ficam "aguardando".
- **Alerta preditivo** acende só ao vivo (não há temperatura gravada).
- **Quilometragem** (12347 KM) ainda é demonstração.
- DEFINITIVO: o cérebro do painel deve rodar **na nuvem** (hoje no navegador).
