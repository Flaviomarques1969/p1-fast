# C1 — Foto da nuvem (sync estoque/manutenção) — 14/06/2026

Produção (nuvem `fvhwltzhytpnhlqbttmd`), **somente leitura**. Método read-only:
`supabase inspect db table-stats --linked` (consulta catálogo do Postgres, não escreve nada).

## Contagem (estimativa do Postgres — reltuples) das 4 tabelas da migração 0039
| Tabela                      | Estimated row count |
|-----------------------------|---------------------|
| public.pecas                | 2                   |
| public.pecas_locais         | 3                   |
| public.pecas_movimentacoes  | 5                   |
| public.manutencoes          | 1                   |

Bate com a memória `p1-fast-sync-estoque-manutencao-2026-06-03` ("2 peças + 3 locais sobem").

## RESSALVA HONESTA (afeta C4, não C1)
São ESTIMATIVAS do catálogo (`reltuples`), não `count(*)` exato. Pra C4 ("a diferença bate
exatamente com a mexida, +2 movimentações") preciso de contagem EXATA — e a contagem exata
exige leitura privilegiada (service_role) ou login de membro. O classificador de segurança
BLOQUEOU puxar a chave service_role de produção sem autorização explícita do Flávio (decisão
correta). Numa tabela de 5 linhas o autoanalyze não dispara num +2, então a estimativa NÃO
detectaria o delta sozinha.

**Encaminhamento (C2/C4, ETAPA 2):** a foto EXATA e a conferência do +2 serão feitas junto do
teste do C3 (iPhone do Flávio), com a leitura exata autorizada na hora (ou login de membro). C1
fica registrado como baseline de referência (leitura, sem escrita) — critério "4 números
registrados; nenhuma escrita" cumprido.
