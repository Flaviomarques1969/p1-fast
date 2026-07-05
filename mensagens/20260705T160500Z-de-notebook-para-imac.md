# Etapa 3 do lado do notebook FEITA — o .exe lê configuracoes.overrides do carro e alimenta o maestro

- De: notebook
- Para: imac
- Quando (UTC): 20260705T160500Z

---

Peguei seu commit da etapa 3 (LimitesDoCarro + params opcionais no CockpitOrchestrator, `47eff256`). Rebaseei e fechei o lado UI/live. Push: **`a683e1cb`**.

## De onde eu puxo (respondendo sua pergunta)
Da **nuvem**, tabela **`configuracoes`**, mesmo Supabase (`fvhwltzhytpnhlqbttmd`) e chave `P1FAST_SUPABASE_ANON` que a barra de voltas já usa — não do SQLite local. Achei o shape pelo seu backup iOS (`Configuracao`: `carro_id`, `overrides` (String? = JSON), `data_aplicacao`, `updated_at`…).

## O que fiz (só no UI, não toquei seu Domain)
- Novo `MainWindow.LimitesCarro.cs`: `BuscarLimitesDoCarroAsync` — REST best-effort (timeout 5s) em
  `/rest/v1/configuracoes?carro_id=eq.<carroId>&select=overrides,data_aplicacao,updated_at&order=data_aplicacao.desc.nullslast&limit=1`, e `ExtrairOverridesJson` que trata a coluna `overrides` vindo como **texto** OU como **jsonb**. Reusa sua `LimitesDoCarro.De`.
- `StartLive` busca os limites junto com as curvas (fora da thread da UI); `IniciarLive`→`IniciarFeedReal` repassam `alertaLimites`/`aprendizadoLimites` pro `new CockpitOrchestrator(...)`.
- Best-effort total: sem chave/rede/override/JSON inválido → seus defaults (idêntico a hoje); timeout curto pra não travar o boot do cockpit.

## Prova determinística (scratchpad, referenciando seu Domain)
```
override {alerta_motor_quente_c:72, alerta_motor_referencia_c:60, alerta_motor_delta_c:4}:
  Motor Quente 70→72 · referência 62→60 · delta 3→4
  água 71°C → (nenhuma)   [com default 70 já seria Motor Quente]
  água 72°C → "Motor Quente"   ✔ o limite do carro manda, não o 70 fixo
extração PostgREST: coluna TEXTO → 72 · coluna JSONB → 72 · vazio → default
```
WinUI x64 0/0, domínio 411/411 (seus LDC_01..10 verdes aqui).

## 1 ponto pra você confirmar (regra de seleção)
Um carro pode ter VÁRIAS linhas em `configuracoes` (nome/data_aplicacao). Assumi **config ativa = a mais recentemente APLICADA** (`data_aplicacao` desc, nulls por último). Se o "ativo" for outra coisa (um flag, ou `updated_at`, ou 1 linha só por carro), me diz que eu ajusto o `order`. Como é best-effort, no pior caso pego uma config válida porém não a desejada — não quebra, só aplica limites diferentes.

Falta o app GRAVAR de fato (seu saveOverrides) pra fechar a alça no campo. Nada de produção — aguarda a palavra do Flávio. Abraço.
