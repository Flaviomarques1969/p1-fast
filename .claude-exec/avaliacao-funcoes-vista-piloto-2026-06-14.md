# Avaliação das 16 funções — Command Box · Vista Piloto (14/06/2026)

Tarefa do Flávio: "vamos focar em cada uma das funções e a gente vai melhorá-las". Trabalho função por função.
Levantamento real (16 leitores + 1 conferente sobre `_design-reference/mockup-command-box-vista-piloto.html`, ~316KB). Tudo conferido no código — nada inferido.

**Mapa visual:** `relatorios/mapa-funcoes-vista-piloto-2026-06-14.html` (aberto no navegador).

## Estado de cada função (fonte do dado)
- **REAL ao vivo (1):** Velocidade (GPS do iPhone). [Carro mostra só a temp. do motor real.]
- **AGUARDA SENSOR (3):** Carro (câmbio/óleos), Pneus, Combustível — não há peça no carro.
- **DEMONSTRAÇÃO (10):** Shift Light, Mapa, P1 Coach, Plano do stint, Barra do stint, Delta acumulado, Passagem, Frenagem, Vmin, Checklist.
- **ENFEITE FIXO (2):** Topo/Header (10 indicadores + mensagem), Vídeo.

## Erros REAIS de código (▲ — independem de sensor, dá pra corrigir já)
1. **Shift Light** calibrado pro MOTOR ERRADO (7.800/8.400 rpm). Contraria a regra dura: luz por torque na roda, redline 6.300 = só sirene. Marcha nunca aparece (liveGear sempre "—").
2. **Plano do stint:** barra de progresso e "ritmo vs plano" NÃO mexem — o código escreve em campo (`volta`) que não existe na tela (HTML usa `voltaN/voltaPct/metaTag`).
3. **Barra do stint:** total de voltas travado em 8 (ignora 12). Marcas de "box" somem após a 1ª volta (rebuildStintBar não repassa pitStops).
4. **Delta acumulado:** em 0,00s a cor cai em vermelho (parece perda no empate). Número sem sinal (+/−).
5. **Carro/Pneus:** sem sensor, mostram ZERO (igual a pane) em vez de "—". Limites são de "Stock Car turbo", não do Celta 1.4.
6. **Frenagem:** delta sempre vermelho mesmo com veredito verde. 1 referência (ghost) pra todas as curvas. `rebuildFrenagem` duplicada (linhas 5450/5469).
7. **Passagem:** `rebuildPassagem` duplicada (5444/5463). Marcha por ponto existe nos dados mas não é exibida. Barra do ápice some na borda quando erro > 1m.
8. **Mapa:** 3 tempos principais (última/melhor do dia/melhor histórico) congelados. `buildTrail` (rastro) nunca chamado. `data-overlay-ghost` consultado mas não existe no DOM.
9. **P1 Coach:** alerta preditivo é decorativo (campos nunca alimentados). Nota da volta inventada por volta.
10. **Checklist:** lista de CHEGADA é placeholder ("Flávio define lista real").
11. **Topo/Header:** 10 indicadores + mensagem do box hardcoded (nunca mudam). Botão Piloto/Engenheiro não serve na TV (Apple TV, sem clique).
12. **Vídeo:** relógio "02:48" falso e parado; bloco sem badge de estado.
13. **Velocidade:** odômetro falso; faixa vermelha do mostrador de outro carro; falta contexto "rápido/lento vs melhor volta".

## Temas transversais (a crítica apontou — valem pra TODAS)
- Ao ligar o carro de verdade, 13 das 16 funções esmaecem e/ou seguem rodando demonstração por baixo. Comportamento da transição simulado→real precisa ser pensado como um todo.
- Legibilidade na TV grande (a 3m): delta acumulado muito baixo, marcas do combustível invisíveis, Carro 2x2 apertado.
- "Modo edição (arraste os blocos)" e botão Piloto/Engenheiro são artefatos de mockup — não devem ir pra Apple TV.

## Ordem proposta de ataque (recomendação)
Começar pelo **Shift Light** (mais grave: ensina referência errada e contraria decisão fechada do Flávio; tem memória e decisões prontas pra embasar — modos Durabilidade/Normal/Agressivo, torque na roda). Depois seguir pelos ▲ de bug puro (Plano do stint, Barra do stint, Delta). Flávio decide a ordem.

## Regras a respeitar ao mexer
- Command Box é SÓ visualização — nunca pôr botão de ação.
- Não mexer nas posições dos blocos (arranjo do Flávio = vista-piloto-ATUAL.json). Backup antes de qualquer alteração no mockup.
- Abrir o mockup sempre pela 8078.
- Sem emoji; largura total; texto de gestor.
