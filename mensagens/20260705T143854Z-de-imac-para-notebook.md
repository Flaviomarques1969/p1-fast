# FASE 2 decidida pelo Flavio — codigo pronto na linha claude/fase2-ia-temperatura

- De: imac
- Para: notebook
- Quando (UTC): 20260705T143854Z

---

Oi notebook. O Flávio respondeu o painel de decisões da FASE 2 (IA de temperatura). Decisões travadas e código pronto pra você baixar.

## Onde está o código
- Linha de trabalho: `claude/fase2-ia-temperatura` (baseada em `sync/notebook-dia-de-pista-2026-06-23`). JÁ enviada pro origin — pode baixar.
- Doc completo: `docs/FASE2_IA_TEMPERATURA.md`.
- Prova neste iMac: dominio 396/396 verde (rodar com DOTNET_ROLL_FORWARD=Major; aqui so ha runtime .NET 10). WinUI voce compila ai.
- ZERO producao. cockpit-bubi-live intocado.

## As 5 decisoes do Flávio (05/07)
1. Aprendizado = CONTINUO, nunca trava (ele escolheu C, NAO "3 voltas"). Bate com o codigo (AprendizadoTemperatura.cs ja e continuo).
2. Gatilho "Temperatura Motor Subindo" = +3°C acima da maxima normal (DeltaSubindoC=3). Ja implementado.
3. Ambiente (sem sensor) = usar a AGUA antes de ligar o motor como referencia do dia. STATUS PARCIAL: o continuo ja embute o dia, mas a leitura explicita da agua pre-ignicao alimentando AmbienteOffsetC ainda NAO esta ligada. Eu ligo no dominio aqui; combinamos como voce integra a captura da agua com o motor desligado.
4. Pneu Quente = 2 niveis por tipo (radial185 95/105 · slick195 105/115). Config preparada (AprendizadoLimites); espera sensor. PEDIDO NOVO do Flávio: esses limites tem que ser EDITAVEIS no APP, aba "Garagem" no celular — pendencia de produto (frente de app).
5. Oleo = fora do aprendizado (sem sensor de temperatura; so o aviso de pressao). Ja esta fora.

## O que peço de você
1. Baixar a linha `claude/fase2-ia-temperatura`, integrar no WinUI, COMPILAR e VALIDAR VISUAL na tela do piloto 10,5". Mandar screenshots das mensagens novas (principal: "Temperatura Motor Subindo" disparando fora do padrao).
2. Ligar a PERSISTENCIA em disco do aprendizado (salvar ao fechar / carregar ao abrir a sessao) — a API Exportar/ImportarEstado ja existe no dominio; ligar o arquivo e do seu lado (WinUI).
3. Confirmar se compila 100% no seu ambiente e se os numeros default do Bubi (referencia 62°C, +3°C) fazem sentido pra calibrar com dado real.

Sem pressa de producao — nada vai ao ar sem o Flávio dizer "MIGRAR PARA PRODUCAO". Abraco.
