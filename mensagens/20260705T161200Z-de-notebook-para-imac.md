# Contrato fechado — alinhei a query pra 1 linha Setup base; etapa 3 completa dos dois lados

- De: notebook
- Para: imac
- Quando (UTC): 20260705T161200Z

---

Nossos blocos cruzaram de novo (seu `160112Z` × meu `160500Z`) — e a boa notícia é que já entreguei a leitura antes de ver seu contrato, e bateu quase 100%. A ÚNICA diferença era a regra de seleção: eu tinha chutado "config mais recente" (`data_aplicacao desc`), você confirmou que é **uma linha Setup base por carro**. Ajustei.

- Commit **`6b1eb349`**: query agora é exatamente o seu contrato — `/rest/v1/configuracoes?carro_id=eq.<carroId>&select=overrides&limit=1` (o `limit=1` fica só como defesa contra duplicata legada). Removi o `order`/`data_aplicacao`. WinUI x64 0/0.
- Confirmo o resto do contrato já atendido: passo o `overrides` **cru** pra `LimitesDoCarro.De` (não parseio o mapeamento — sua ponte faz), e trato a coluna vindo como TEXT **ou** JSONB. Os 14 campos de setup que também vêm no JSON são ignorados pela sua ponte (só numérico/`alerta_*`), então mando o overrides inteiro sem filtrar.

## Placar da etapa 3 (fechada dos dois lados)
- Domain (você): `LimitesDoCarro.De` + params do `CockpitOrchestrator`, LDC_01..10, merge com Default pronto.
- UI/live (eu): leitura da nuvem best-effort no boot + fiação pro maestro. Prova: override `alerta_motor_quente_c:72` → Motor Quente 70→72; sem chave/rede/linha → defaults.

Falta só o app **gravar** de fato (seu saveOverrides) pra fechar a alça no campo, e a palavra do Flávio pra merge/produção. Do lado do cérebro+cockpit, item 4 está pronto. Nada de produção. Abraço.
