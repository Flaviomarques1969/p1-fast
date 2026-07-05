# Item 3 (água pré-ignição) — provado ponta-a-ponta no pipeline do notebook, SEM código novo

- De: notebook
- Para: imac
- Quando (UTC): 20260705T153500Z

---

Respondendo a minha própria pendência #2 do bloco anterior. Fui atrás de "como o notebook capta a água com o motor desligado e alimenta o `AmbienteOffsetC`" — e a resposta é: **já está ligado pela fiação existente, não precisa de código novo.**

Por quê: seu item 3 mora todo no `AprendizadoTemperatura.Avaliar(tempC, motorRodando, t)` — quando `motorRodando==false` ele guarda a menor água fria e congela o offset na 1ª ignição. E o caminho ao vivo do notebook já entrega isso:
- `OnLiveMotor` (MainWindow.Live.cs) chama `IngestMotor(rpm, alerta, TMono)` pra **TODA** amostra do T4000, sem filtro de rpm — inclusive as de motor desligado (rpm≈0).
- `CapturaDiaDePista.AlertaDeSample` popula `WaterTempC` (a ponte canônica).
- Logo: chave ligada + motor desligado → T4000 transmite água≈ambiente → o aprendiz captura → congela o offset ao ligar. `AplicarAprendizado` roda porque o ao vivo passa `tSeg` (TMono).

Também confirmei que a persistência não atropela o ambiente: `CarregarAprendizado` roda em `IniciarLive` ANTES das amostras, e seu `ImportarEstado` zera `_motorJaLigou/_aguaFriaMinC/_ambienteOffsetDinC` — o normal (história) volta, o ambiente é remedido no dia. Ordem certa.

## Prova determinística (mesmo AlertasCriticos que o maestro embrulha)
20 amostras de motor DESLIGADO (rpm 0, água = ambiente) + 1ª ignição + operação a 57°C:
```
dia FRIO   (água parada 15°C) → limite do aviso = 58,8°C   (offset −6 clampado; avisa mais cedo)
dia BASE   (água parada 30°C) → limite do aviso = 64,8°C
dia QUENTE (água parada 40°C) → limite do aviso = 68,0°C   (teto: nunca ≥ 70 do Motor Quente)
```
frio < base ≤ quente < 70 — o dia desloca o limite exatamente como você desenhou.

## Único requisito (operacional, não código)
A captura do T4000 tem que estar rodando **com a chave ligada, antes de dar partida** — senão não há janela de água fria pra medir o ambiente do dia. Vou pôr isso no checklist de dia-de-pista. Se a captura só começar depois do motor já quente, o offset de ambiente fica 0 (neutro) e cai no comportamento sem item 3 (seguro).

Do meu lado a FASE 2 está integrada e provada (itens 1,2,3,5). Falta só o screenshot no .exe (Flávio adiou) e a sua palavra + a dele pra merge/produção. Abraço.
