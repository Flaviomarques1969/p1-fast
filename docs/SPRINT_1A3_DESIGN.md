> ⚠️ **DOCUMENTO OBSOLETO** — preservado pra histórico (auditoria 2026-05-12).
>
> A nomenclatura "Sprint 1A.X" foi substituída em 2026-05-03 pelo esquema
> "MS-X" do `docs/PLANO_FASE_1.md`. O escopo descrito aqui foi entregue e
> mergeado faz tempo. Não usar como guia pra trabalho novo.
>
> Referência canônica vigente: `STATUS.md` + `docs/PLANO_FASE_1.md`.

---

# Sprint 1A.3 — Hub iOS (resto do CRUD + cadastros)

> Status: **proposta**, não implementado. Documento pré-prompt pra travar
> escopo ANTES do Cloud Code começar. Continua a sequência 1A.1 (fundação) +
> 1A.2 (Home/Garagem/Eventos) iniciada em 2026-05-01.

## O que é

Os mockups canônicos em `_design-reference/` cobrem **17 telas/modais** além
das 4 do 1A.2 (Home cheio/vazio, Garagem, Carro, Carro novo, Eventos lista,
Evento detalhe). Sprint 1A.3 fecha o resto do "hub" — cadastros auxiliares
e a tela de stint (que é a ponte pro cockpit ao vivo).

## Mockups a portar

| # | Mockup canônico | Descrição |
|---|---|---|
| 11 | `mockup-stint.html` | Modal de criação de stint (objetivo, piloto, voltas planejadas, lição focada) |
| 12 | `mockup-pos-stint.html` | Tela pós-stint: voltas + tempos + tags (PB, desvio) + nota |
| 13 | `mockup-piloto-lista.html` + `mockup-piloto-cadastro.html` | CRUD pilotos do time |
| 14 | `mockup-passageiro-lista.html` + `mockup-passageiro-cadastro.html` | CRUD passageiros |
| 15 | `mockup-pneu-lista.html` + `mockup-pneu-cadastro.html` | CRUD pneus por carro |
| 16 | `mockup-combustivel-lista.html` + `mockup-combustivel-cadastro.html` | CRUD combustíveis |
| 17 | `mockup-licao-lista.html` | Catálogo de lições pedagógicas |
| 18 | `mockup-pendencias-cascata.html` | Lista de pendências (já tem schemas em src/data/schemas.js: SEED_PEND_TIPOS) |
| 19 | `mockup-trecho-lista.html` | Lista de trechos da pista (curvas com apex defaults) |
| 20 | `mockup-setup-avancado.html` | Setup avançado de carro (14 overrides) — extensão do Modal Carro do #9 |
| 21 | `mockup-reacoes-aprendidas.html` | Tela de pilot reaction profiles (Sprint 1A.1 schema v12) |
| 22 | `mockup-shift-cards.html` | Cartões de eventos de shift (smart shift light, Dexie v11) |

**Não em 1A.3** (vão pro 1B+):
- `mockup-cockpit-piloto.html`, `mockup-cockpit-ghost.html`, `mockup-cockpit-comparacao.html` — Sprint 1B (cockpit ao vivo na pista)

## Quebra em prompts

7 prompts (1 por bloco lógico):

### #11 — Modal Stint + tela Pós-Stint
**blockedBy**: #10 (Eventos detalhe) — stint é criado dentro de evento.

`mockup-stint.html` + `mockup-pos-stint.html` portados. CRUD via GRDB
(`sessoes`, `voltas`, `segment_executions`). Usa tokens semânticos do hub
(\`bom\`, \`atencao\`, \`ouro\` pro PB do dia).

Aceitação:
- Criar stint dentro de evento → vai pra "ATIVO" no detalhe
- Finalizar stint → mostra pós-stint com voltas + tags
- swift smoke + xcodebuild verdes

### #12 — Pilotos CRUD
**blockedBy**: #7 (Theme + componentes).

Lista + cadastro. Usa `BottomNav` com Pilotos ativo (4ª aba?). Tabela
GRDB `pilotos` já existe.

### #13 — Passageiros CRUD
**blockedBy**: #7. Quase idêntico a #12 (mesma forma, tabela diferente).

Decisão aberta: vale fazer prompt separado ou bundle com #12 ("Pessoas")?
**Sugestão: bundle**. Reduz overhead de PR.

### #14 — Pneus CRUD (por carro)
**blockedBy**: #9 (Garagem). Modal de pneu vive dentro do detalhe do carro
ou em tela separada? Mockup tem ambas as views — bundle.

### #15 — Combustíveis CRUD
**blockedBy**: #7. Independente de carro (combustível é de evento).

### #16 — Catálogos auxiliares (Lições + Pendências + Trechos + Reações)
**blockedBy**: #11.

Tela read-only (lições, trechos, reações aprendidas) + CRUD pendências.
Bundle por proximidade conceitual (todas são listas + drill-down).

### #17 — Setup avançado + Shift cards
**blockedBy**: #14.

Setup avançado é extensão do Modal Carro (14 overrides em 5 grupos).
Shift cards é visualização dos eventos de shift light (Dexie v11
`shift_events`). Bundle.

## Decisões abertas

1. **BottomNav: 3 ou 4 abas?** Hoje é 3 (Home/Garagem/Eventos). #12+#13
   adicionam Pilotos+Passageiros — vira "Pessoas" como 4ª? Ou submenu
   dentro de Configurações?

2. **Tela "Configurações"?** Combustíveis, lições, pendências, trechos,
   reações — tudo isso é "configuração". Talvez justifique uma 4ª aba
   "Mais" ou "Configurações" com submenu, em vez de aba dedicada por
   entidade.

3. **Stint precisa de Daily.co?** O mockup-stint sugere lição focada
   (link com `mockup-licao-lista`). Daily.co pode entrar no #11 pra
   teleconsulta com coach durante stint? Ou fica fora do escopo?

4. **Quando começar a usar sync_queue?** Hoje todas as mutations dos
   prompts #8-#10 vão GRDB local sem sync. A partir de qual prompt o
   `MutationLogger` entra automaticamente? Sugestão: implementar no
   #11 junto com a primeira mutation "valiosa" (stint) e retroaplicar
   nos anteriores.

5. **Fluxo de criação de stint — sheet, push ou full screen?**
   Mockup é fullscreen mas SwiftUI sheet seria mais natural pra modal.
   Decidir antes de implementar pra não retrabalho.

## Pré-requisitos antes de começar 1A.3

- [ ] 1A.2 fechado (#9 Garagem + #10 Eventos mergeados)
- [ ] Decisões 1-5 acima resolvidas
- [ ] (Opcional) Sprint 1A.6 já tendo a Edge Function `sync` no ar permite
      MutationLogger real desde o #11

## Ordem sugerida de execução

```
#9 Garagem (1A.2, em andamento)
   ↓
#10 Eventos (1A.2, fila)
   ↓
#11 Stint + Pós-stint (1A.3) ← entrada do 1A.3
   ↓
[#12+#13 Pessoas] e [#14 Pneus] e [#15 Combustíveis] em PARALELO
   ↓
#16 Catálogos
   ↓
#17 Setup avançado + Shift cards
```

7 prompts em ~2 sprints (alguns podem rodar em paralelo). Total estimado
do hub completo (1A.2 + 1A.3): 11 prompts + 7 = 18 telas, mais cockpit
ao vivo (1B) separado.

## Métrica de sucesso 1A.3

App iOS instalado em iPhone físico permite (sem cockpit, sem rede):
1. Cadastrar carro, piloto, pneu, combustível
2. Criar evento + criar stint
3. Lançar voltas + tempos no pós-stint
4. Listar pendências do evento
5. Ver lições + trechos + reações aprendidas

Tudo offline, GRDB local. Sync remoto fica pra Sprint 1A.6 (já desenhado
em `docs/SPRINT_1A6_SYNC_DRAINER_DESIGN.md`).

## Não-objetivos de 1A.3

- Cockpit ao vivo (Sprint 1B)
- Sync remoto (Sprint 1A.6)
- Onboarding de user/time (passo manual via Studio + RPC `create_team` —
  ver PRE_LAUNCH_CHECKLIST)
- Daily.co teleconsulta (decisão #3 acima)
- Telemetry capture (Sprint 1B com cockpit)
