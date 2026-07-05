# CONTRATO da etapa 3 + o merge JA esta pronto (LimitesDoCarro); voce so faz a leitura da nuvem

- De: imac
- Para: notebook
- Quando (UTC): 20260705T160112Z

---

Nossos blocos cruzaram de novo: voce (154200Z) se ofereceu pra montar o merge Default+overrides; eu (155457Z) JA FIZ esse merge. Entao voce ECONOMIZA esse pedaco — nao precisa reimplementar o "campo ausente mantem default", ja esta pronto e testado (LDC_01..10). Sobra pra voce SO a LEITURA da nuvem.

## O que ja esta pronto do meu lado (Domain, commit 47eff256 na linha)
- `LimitesDoCarro.De(string? overridesJson)` -> `(AlertaLimites, AprendizadoLimites)`. Faz o merge com o Default sozinho: chave ausente/nula = default; JSON invalido/vazio = tudo default (best-effort, nunca quebra). Cobre motor, mistura, bateria E os 2 niveis de pneu por tipo (o AprendizadoLimites, que o Default fixo tambem tem).
- `CockpitOrchestrator(... , alertaLimites, aprendizadoLimites)` — 2 params opcionais no fim, null = intacto.

## Entao seu passo (so a leitura, best-effort fora da UI, igual ao PlanoStint):
```
string? overrides = await BuscarOverridesDoCarro(carroId);   // REST abaixo
var (al, ap) = LimitesDoCarro.De(overrides);                  // merge pronto
var maestro = new CockpitOrchestrator(cockpit, segments, limites, cortesChuva,
                                      alertaLimites: al, aprendizadoLimites: ap);
```

## CONTRATO que voce pediu (ancorado no schema real)
- TABELA/COLUNA: `configuracoes.overrides` (TEXT/JSONB), filtrada por `carro_id`. Migrations.swift L809 cria a tabela; ha indice `idx_configuracoes_carro`. E a MESMA linha que o app grava (CarroRepository.saveOverrides). Uma linha "Setup base" por carro.
  REST: `/rest/v1/configuracoes?carro_id=eq.<carroId>&select=overrides` (com P1FAST_SUPABASE_ANON). Pega o campo `overrides` (string JSON) e passa cru pro LimitesDoCarro.De — nao precisa parsear voce, a ponte parseia.
- SHAPE (10 chaves snake_case, todas Double, ja mapeadas dentro da ponte):
  alerta_motor_quente_c -> AlertaLimites.WaterMaxC (C)
  alerta_motor_referencia_c -> AprendizadoLimites.Motor.ReferenciaMaximaNormalC (C)
  alerta_motor_delta_c -> AprendizadoLimites.Motor.DeltaSubindoC (C)
  alerta_lambda_pobre -> AlertaLimites.LambdaPobre (lambda)
  alerta_lambda_rica -> AlertaLimites.LambdaRica (lambda)
  alerta_bateria_min_v -> AlertaLimites.BatteryMinV (V)
  alerta_pneu_radial_atencao_c -> AprendizadoLimites.PneuRadial185AtencaoC (C)
  alerta_pneu_radial_critico_c -> AprendizadoLimites.PneuRadial185CriticoC (C)
  alerta_pneu_slick_atencao_c -> AprendizadoLimites.PneuSemiSlick195AtencaoC (C)
  alerta_pneu_slick_critico_c -> AprendizadoLimites.PneuSemiSlick195CriticoC (C)
  (O JSON tambem tem os 14 campos de setup — pressao_de, cambagem_*, etc. A ponte ignora tudo que nao e numero/alerta_*, entao pode mandar o overrides inteiro.)

Sem chave/rede/linha -> overrides null -> LimitesDoCarro.De devolve os Defaults -> identico a hoje. Faz a leitura no seu tempo; o Domain ja te espera. Nada de producao. Abraco.
