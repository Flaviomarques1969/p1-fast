# Propostas arquivadas — Rodada 1 de ajustes (13/05/2026)

> **Status:** ARQUIVADO em 27/05/2026 por decisão de Flávio (opção 1 do plano de auditoria da submissão #193).
> **NÃO usar diretamente.** Estes arquivos servem apenas como **referência de ideias**. Cada funcionalidade aqui dentro precisa ser implementada do zero quando o Flávio pedir, em cima da versão atual do projeto.

## Por que isto está arquivado em vez de incorporado

A submissão #193 ("Rodada 1 de ajustes — 24 mudanças em 8 entregas (S1–S8)") ficou parada 14 dias na fila de aprovação. Nesse tempo, **a versão oficial do projeto avançou muito** — vieram trabalhos novos de:

- Central T4000 (simulador + leitor + autorrecuperação)
- Painel piloto v04 (detector de trechos + carregador de pista + curva de dinamômetro)
- Engenharia (modelo + 3 regras de calibração)
- Pesquisa Bubi (dinamômetro + cobertura T LINE)
- Videoconferência (rota nova de aviso de gravação)
- Conserto da idempotência (PR #217 que destravou o motor de envio do iPhone)

Incorporar a #193 do jeito que estava **apagaria todos esses trabalhos** porque a submissão era de uma data anterior. Auditoria detalhada em 27/05 mostrou que a #193 queria apagar 61 arquivos e modificar outros 37 (incluindo o conserto da idempotência).

## O que sobrou de útil — arquivado aqui

Os **12 arquivos NOVOS** que a #193 trazia (que não conflitavam com nada porque eram criações). Agrupados em 6 funcionalidades:

| Pasta | Funcionalidade | Arquivos |
|---|---|---|
| `design-reference/` | Proposta visual do card de carro | `proposta-carro-card-S2.html` |
| `ios-views/` | Tela de detalhe da volta | `VoltaDetalheView.swift` |
| `ios-views/` | Telas de relatórios extras | `RelatoriosViews.swift` |
| `ios-views/` | Foto do carro na garagem | `FotoCarroSection.swift` |
| `ios-persistence/` | Repositórios extras de evento | `EventoExtraRepositories.swift` |
| `ios-persistence/` | Massa de dados de teste | `SeedMassaTestes.swift` |
| `migrations-banco/` | 6 mudanças do banco | `0020_carros_foto_url.sql`, `0021_tracks_cidade.sql`, `0022_pendencias_consumiveis.sql`, `0023_pneus_serie_evento.sql`, `0024_acoes_a_fazer.sql`, `0025_evento_setup_replicado.sql` |

## ⚠️ Atenção sobre as mudanças do banco (`migrations-banco/`)

A numeração `0020`–`0025` **já foi usada por outras mudanças** que foram aplicadas no banco da nuvem em datas posteriores (engineering findings, dyno, sincronização iPhone, gravação de vídeo). Se algum dia essas 6 mudanças forem reaproveitadas, **precisam ser renumeradas pra `0026`–`0031`** (ou número livre na época).

## O que cada funcionalidade entrega (resumo curto pra reaproveitamento futuro)

| Funcionalidade | O que faz | Quando faz sentido reaproveitar |
|---|---|---|
| **Foto do carro** | Permite ao piloto subir uma foto do carro pra aparecer na garagem | Quando Flávio quiser foto identificadora |
| **Cidade nos autódromos** | Adiciona coluna `cidade` em `tracks` pra agrupar | Quando quiser tela de autódromos agrupada por cidade |
| **Pendência de consumível** | Permite registrar pendência de óleo, pastilha, etc. com quantidade e custo | Quando quiser controle de gasto operacional |
| **Pneu por série / evento** | Liga conjunto de pneus a evento específico | Quando quiser histórico de qual jogo de pneus rodou em qual prova |
| **Ações a fazer** | Lista de tarefas livres (TODO da equipe) | Quando quiser caderninho de ações pendentes |
| **Setup replicado por evento** | Copia setup de evento anterior pro próximo | Quando quiser não recadastrar setup do zero |
| **Tela de detalhe da volta** | Mostra detalhes da volta individual | Já existe parcialmente — comparar antes de usar |
| **Relatórios extras** | Visualizações extras pós-stint | Comparar com o que existe hoje antes de usar |

## Histórico

- **2026-05-12** — Trabalho original começou na linha de trabalho `claude/rodada1-s1` (24 mudanças em 8 entregas).
- **2026-05-13** — Submissão #193 aberta pra aprovação.
- **2026-05-13 a 2026-05-27** — Submissão ficou na fila 14 dias enquanto outros trabalhos avançaram em paralelo.
- **2026-05-27 (sessão de Flávio)** — Auditoria detalhada mostrou conflito grave. Decisão: arquivar.
- **2026-05-27** — Esta pasta foi criada. Submissão #193 encerrada.

## Para o próximo Claude que ler isto

Se Flávio um dia pedir "implementa foto do carro" ou "agrupa autódromos por cidade":
1. Leia o arquivo correspondente nesta pasta como **referência de ideia** (não como código pronto pra colar).
2. Implemente do zero em cima da versão atual do projeto.
3. Numere a mudança do banco a partir do próximo número livre.
4. Abra submissão pra Flávio aprovar.
