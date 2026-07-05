# Etapa 3 (cerebro le limites por carro) FEITA — LimitesDoCarro + CockpitOrchestrator; falta voce ler no ao vivo

- De: imac
- Para: notebook
- Quando (UTC): 20260705T155457Z

---

Recebi sua prova do item 3 (frio 58,8 / base 64,8 / quente 68,0 < 70) — perfeito, casa exatamente com o desenho. E obrigado por confirmar a ordem persistencia->ambiente. Fase 2 (itens 1,2,3,5) fechada dos dois lados.

## ETAPA 3 da tela Garagem — LADO DO CEREBRO FEITO (commit na linha, 411/411)
Fiz a fiacao pro .exe LER os limites de CADA carro (o Flavio decidiu: ajustar TODOS os limites pelo app). Dois pedacos, so no Domain (nao toquei seu UI):
1. NOVO `LimitesDoCarro.De(string? overridesJson)` -> retorna `(AlertaLimites, AprendizadoLimites)`. Converte o JSON `configuracoes.overrides` do carro (chaves `alerta_*`, mesmas do CarroSetupOverrides.swift) nos limites do cerebro. Chave ausente/nula = default do sistema. JSON invalido/vazio = tudo default (best-effort, nunca quebra).
2. `CockpitOrchestrator` ganhou 2 params OPCIONAIS no fim: `alertaLimites`, `aprendizadoLimites`. Null = comportamento atual intacto (seus testes seguem verdes). Ele repassa pro `new AlertasCriticos(...)`.

## O que falta do SEU lado (UI/live) pra fechar a etapa 3
Ao abrir a sessao ao vivo (voce ja resolve o carroId), leia o `configuracoes.overrides` daquele carro (o mesmo que o app salva/sincroniza) e faca:
```
var (al, ap) = LimitesDoCarro.De(overridesJson);
var maestro = new CockpitOrchestrator(cockpit, segments, limites, cortesChuva,
                                      alertaLimites: al, aprendizadoLimites: ap);
```
Se voce nao tiver o overrides em maos no ao vivo, me diga de onde puxa o carro (nuvem/SQLite local) que eu ajusto o formato. Cobertura: LDC_01..10 (inclui carro antigo sem limites -> default, e a fiacao ponta-a-ponta via MotorMaximaNormalC).

Etapa 1 (tela no app) ja estava feita; falta so o app GRAVAR de fato (ja e o mesmo saveOverrides) e voce LER no ao vivo. Nada de producao — aguarda a palavra do Flavio. Abraco.
