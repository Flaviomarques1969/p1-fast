# TASK — Estudo: melhor forma de exibir o Vmin no bloco do Command Box

> Registro anterior (tela de comparação de voltas) preservado em
> `.claude-exec/ultima-tarefa.backup-2026-06-27-pre-estudo-vmin.md`.

## 1. Pedido original de Flávio
"a função vmin, em command box, não faz sentido o gráfico usado. vmin é uma velocidade em um ponto. não faz sentido um gráfico com o que está. faça um estudo com um agente avançado senior em pilotagem e veja a melhor forma de mostrar vmin neste painel no box. seria interessante mostrar também qual foi a velocidade do vmin na melhor passagem naquele trecho."

## 2. Objetivo (1 frase)
Estudar, com agente sênior em pilotagem, a melhor forma de exibir o Vmin no bloco do Command Box (hoje um gráfico de curva) e como mostrar também o Vmin da melhor passagem do trecho.

## 3. Critérios objetivos de conclusão
- Estudo feito por agente sênior em pilotagem, fundamentado no painel real (não inventado).
- Recomendação clara da melhor forma de exibir Vmin.
- Resposta a "mostrar Vmin da melhor passagem do trecho" — confirmar se o dado já existe e como exibir.
- Entrega como ESTUDO + recomendação. NÃO alterar código até Flávio escolher a forma.

## 4. Leitura confirmada
- ~/.claude/CLAUDE.md — sim
- ~/.claude-decisoes/padroes.md — sim (vazio, 0 decisões)
- ~/.claude/FLAVIO_EXECUTION_PROTOCOL.md — sim
- ~/.claude/FLAVIO_DONE_CHECKLIST.md — sim
- ~/.claude/FLAVIO_ENVIRONMENT_RULES.md — sim
- ~/.claude/FLAVIO_COMMUNICATION_RULES.md — sim
- Projeto: CLAUDE.md + memórias P1 Fast — sim

## 5. Plano (≤5 passos)
1. Inspecionar bloco VMIN real + motores de dado. FEITO.
2. Recuperar duvidas-vmin.html (3 perguntas nunca decididas). FEITO.
3. Rodar agente sênior em pilotagem com contexto real.
4. Sintetizar em recomendação + opções clicáveis pra Flávio decidir.
5. NÃO implementar até Flávio escolher.

## 6. Arquivos inspecionados
- _design-reference/mockup-command-box-vista-piloto.html (vminChartSvg/buildVminPanel ~4549-4654)
- web/command-box/vmin-curvas-reais.js
- web/command-box/vmin-aprendizado.js
- _design-reference/_propostas-pr205/duvidas-vmin.html

## 7. Ambiente
- Alvo: DESENVOLVIMENTO (estudo / design reference).
- Produção protegida: sim.
- Autorização para produção: não.
- Evidência: não recebida.

## 8. Riscos
- Baixo: estudo sem alteração de código. Risco só se eu implementar antes de Flávio escolher — não vou.

## 9. Achados verificados (evidência)
- Hoje o bloco mostra GRÁFICO de curva velocidade × distância-ao-Vmin (U-shape), live + ghost — a "opção A" de duvidas-vmin.html, nunca formalmente escolhida (0/3 respondidos).
- O Vmin da MELHOR passagem do trecho JÁ é calculado (`bestVmin`, vmin-curvas-reais.js:97; `referencia().vminKmh`, vmin-aprendizado.js) mas NÃO é exibido como número — só vira o `delta` e a curva ghost.
- Honestidade ~1 Hz: Vmin confiável só quando é VALE de verdade; senão "sem leitura limpa".
- Bases por config de pneu SEPARADAS (radial × semi-slick).

## 10. Status: estudo CONCLUÍDO — aguardando Flávio escolher a forma (card aberto)

- Agente sênior em pilotagem rodou e entregou estudo fundamentado nos 4 arquivos reais.
- Veredicto: Flávio está certo — a curva é forma errada p/ um Vmin (escalar) e repete FRENAGEM + PASSAGEM.
- Recomendação: número herói do Vmin + "melhor 89" (Vmin da melhor passagem, já calculado) + veredicto colorido + barrinha fina; sem curva.
- Card de decisão: .claude-perguntas/pendentes/20260627-110638-p1-fast.html (tipo ux). 3 opções + Outra.
- NENHUM código alterado. Implementação só após escolha.
- 3 sub-decisões anotadas p/ depois: manter ou não a barrinha; cor de "alto" (recomendo âmbar); gatear a referência na confiabilidade dela.
