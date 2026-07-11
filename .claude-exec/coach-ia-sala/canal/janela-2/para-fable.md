# Caixa da Janela 2 → Fable — só a Janela 2 escreve aqui

> Sempre ACRESCENTE blocos com hora (`date -u +%FT%TZ`); nunca sobrescreva. Poste o rascunho do objeto oportunidade ASSIM QUE tiver (destrava J1/J3/J5). O bloco final obrigatório é o `PRONTO PARA AUDITORIA` do seu prompt.

### 2026-07-08T19:10:27Z — Janela 2 · RASCUNHO DO OBJETO OPORTUNIDADE (destrava J1/J3/J5)
Objeto oportunidade v1 publicado em entregas/janela-2.md §1. Confirmo o v0 do Fable e acrescento (para o Fable arbitrar): tipoCurva, confianca.origem='derivada-J2', reconciliacao{tempoTrechoAtualS,gapMedidoS,escala}, projecao{voltasRestantes,adesao,base}, apice{distFromIdealM,angleFromIdealDeg}, subTrecho pode ser null (fallback de curva curta), e um companheiro status{estado,voltasObservadas,motivo} para o "sem oportunidade" honesto. Nada dos itens travados muda (ganho em s; número positivo; segmentId=UUID; 5 subs literais; curvaNome das 8). J1 lê subTrecho/tipo/tecnica/ganhoVoltaS/confianca/evidencia; J3 lê segmentId/tracos/apice; J5 lê tudo.

### 2026-07-08T19:10:27Z — Janela 2 · PRONTO PARA AUDITORIA
Entrega: entregas/janela-2.md (completa)
Resumo (5 linhas):
- Objeto oportunidade v1 fechado (§1) = v0 do Fable + acréscimos provados necessários pelo painel adversário; itens travados intactos.
- Ganho em SEGUNDOS ancorado no relógio (tempo_trecho_s medido = teto); porSubTrecho só diz ONDE; escala<=1 mata a dupla contagem (curva x sub e recorrente x pontual). Quantil baixo p/ volta; adesao<1 p/ stint (voltasRestantes real de StintPlan.nVoltasAlvo, senão null).
- Sinal vs ruído: separação vem do STINT (repetição volta-a-volta), não da volta; dois pisos (0,05 medição / 0,10 eleição); confiança derivada-J2 (fAmostras×fConsistencia×fMagnitude) com gates SF/pace/apice; out-lap e curva-curta tratados.
- Eleição B (pontuação ponderada) endurecida, determinística, roda no .exe; A é caso degenerado; C (LLM) só offline no box, nunca calcula ganho. Reusa a prescrição v3 de oportunidade-trecho.js; J2 fica ACIMA (elege a única).
- Achado real do fixture: maior perda de UMA volta = out-lap (armadilha, +3s); oportunidade REAL = Curva "S" ~1s em 5/5 voltas voadoras (confiança ALTA).
Consumi: motor de delta (calcularDelta) + fixture real (56 passagens = 8 curvas x 7 voltas) + tipos-curva + trecho-detector + migração 0026 + stint-plan.js. Produzi: objeto oportunidade { §1 } + algoritmo + método do ganho em s + encaixe no motor.
Autoconferência da régua: preto · sem-emoji · você · 956x440 (respeitado; não desenhei tela) · número-sem-sinal · só-dado-real (marcha removida por falta de sensor) · timing-seguro (portão é da J1) · ganho-em-s · painel-preservado.
Dúvidas/decisões ao maestro: 4 calibrações + acréscimos ao objeto + tempoAtualS no motor JS + marcha fora (entregas/janela-2.md §8). Nenhum bloqueio.

Correção de processo digna de nota: um dos fiscais "citou" web/command-box/oportunidade-trecho.js como inexistente e outro como existente; conferi no código — o arquivo EXISTE em web/cockpit/oportunidade-trecho.js (v3 aprovado 09/06). Não descartei por engano nem aceitei cego: verifiquei antes de citar.

### 2026-07-08T22:01:16Z — Janela 2 · PRONTO PARA AUDITORIA (v1.1 — CORRIGIR do QA da J5 aplicado)
Entrega: entregas/janela-2.md (atualizada; método central inalterado — a J5 reproduziu os números exatos).
Apliquei os 4 pontos do seu bloco 20:55Z:
- F2 (confiança ambígua): fixei a janela de contagem do fAmostras em AGREGADA no stint (§4.3) e reescrevi os DOIS exemplos com a mesma régua. Prova real (fixture): "S"=37 pts agregados (5 voadoras) → fAmostras=1 → elege; Placar sub ≈4-5 amostras → não elege no sub, cai no fallback.
- F3a (fallback nunca pontuava): dei régua PRÓPRIA ao fallback — fAmostras sobre os pontos da CURVA inteira (Placar 23, Vitória 28, "S" 37), não sobre um sub. Agora pontua (§5.4).
- F3b (p25×mediana): deixei os DOIS ramos especificados no §5.4 e levei a decisão ao seu §8 item 2 (proponho mediana; muda destino de Vitória/Placar). Decisão do Flávio.
- F8 (ilustrativos): marquei [fixture] vs [ilustrativo] e apontei C1-C5 da J5 como cenários oficiais (nota no topo).
- F1 (limites de segmento): §7.2 novo — o que EU confiro contra as linhas reais (segments-loader.js → TrechoDetector): rodar o detector sobre o fixture e ver se 'freada-iniciou' cai dentro do segmento; veredito fixture-só vs defeito de registro no produto. É investigação (leitura/teste), não alteração de produto; executo com a J4 no passo 0 da Fase 1.
Régua: preto · sem-emoji · você · número-sem-sinal · só-dado-real · ganho-em-s · painel-preservado.
Pendências pro Flávio: 3 (calibração; F3b p25×mediana; marcha fora) — nenhuma bloqueia. Nada de produto tocado.
