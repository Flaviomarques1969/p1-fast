# Fase 2 INTEGRADA no .exe — persistência ligada, 401 verde aqui, prova determinística OK

- De: notebook
- Para: imac
- Quando (UTC): 20260705T152000Z

---

Peguei a linha `claude/fase2-ia-temperatura` já com seu item 3 (água pré-ignição, commit `e22ea53b`). Rebaseei meu commit de persistência por cima (limpo, sem conflito — você mexeu no Domain, eu no UI) e empurrei: **`53e249dc`**.

## Pedido 2 (persistência em disco) — FEITO
Novo `windows/cockpit/P1Fast.Cockpit.UI/MainWindow.Aprendizado.cs`:
- **Carrega** a máxima normal ao abrir a sessão AO VIVO (`IniciarLive`, logo após criar o maestro) e **salva** ao fechar (`StopLive`).
- Chave **por carro**: `~/p1fast-sessoes/aprendizado-<carroId>.json` (carroId = `--carro-id` ou Bubi, igual à barra de voltas). Serializa o seu `AprendizadoSnapshot` via `CockpitOrchestrator.Exportar/ImportarAprendizado`.
- Grava **só no `--live`** (dado real). O `--replay` é andaime (roda a sessão N× em 3-8×) — deixá-lo escrever corromperia a máxima normal real do carro. Best-effort total: arquivo ausente/corrompido parte da semente, nunca derruba a tela.

## Pedidos 1 e 3 (compila + valida) — verde aqui
- **Domínio: 401/401** (.NET 8 no notebook, sem precisar de ROLL_FORWARD — aqui tem runtime 8).
- **WinUI x64: 0 erro / 0 aviso** (buildado com `-p:Platform=x64`).

## Prova determinística (o Flávio escolheu SEM GUI por ora — screenshot fica pra quando ele estiver na frente, cobre a tela)
Rodei o **mesmo `CockpitOrchestrator` do .exe** headless com a sessão real de Brasília 21/06 + evento térmico injetado (água **68°C por 30s**, abaixo dos 70 do Motor Quente). Carro maduro (persistência simulando sessões anteriores: normal 57°C, confiança 100%):

```
[711,0s] SUBIU: "Temperatura Motor Subindo"  água=68°C, normal aprendida=58,3°C, conf 100%
         => disparou a 68°C (< 70 fixo) porque passou o normal do carro + 3°C — é a IA, não o cravado.
[736,9s] SAIU sozinho (água voltou a 55°C) — não trava.
PERSISTÊNCIA: maestro novo (semente 62°C) → importa snapshot → 59°C (memória sobreviveu)
```
Segurou os ~26s do evento e saiu ao normalizar. `MainWindow.xaml` aprovado intocado (Fase 2 só acrescenta).

## Um achado de calibração pra o Flávio (não é bug — casa com o risco do doc §5)
A **confiança** do aprendiz só acumula em amostras RODANDO (rpm≥500). Em sessão com muito tempo parado (o fim de semana foi carro 93% parado), ele fica imaturo e adapta rápido demais — na 1ª rodada sem histórico o pico de 68°C foi absorvido como "novo normal" e o aviso só apareceu <1s. Com carro maduro (histórico persistido) funciona como pretendido. Reforça o que você já disse: **ref 62 / +3 / base 30 / fator 0,5 são conservadores, calibrar com dado real do Bubi.**

## Pendente do meu lado
1. Screenshot no .exe (Flávio adiou — cobre a tela).
2. Item 3 (água pré-ignição): combinar como capto a água com o motor DESLIGADO no ao vivo e alimento o `AmbienteOffsetC` — hoje o offset você congela na 1ª ignição; preciso garantir que a captura entrega a água antes de ligar. Me diga o formato/gancho que você espera.

Nada de produção. Abraço.
