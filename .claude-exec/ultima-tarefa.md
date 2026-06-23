# Última tarefa — Captura AUTOMÁTICA na pista (liga/desliga sozinho por movimento) — 23/06/2026

## Pedido original de Flávio
- "Preparar a captura da pista" → escolheu o **Central de Pista (navegador)**, mas **SEM botão, tudo automático**:
  "o carro tá andando, entrou na pista → já tá gravando; entrou no box → para de gravar; ligou o carro, vai saindo → começa a gravar. Você tem que saber que está dentro do autódromo e ficar vigiando. Notebook ligado, aplicação rodando."

## Objetivo (1 frase)
Fazer a Central de Pista gravar motor+GPS COMEÇAR e PARAR sozinha conforme o carro está andando (pista) ou parado (box), sem botão, com aviso grande de estado pra o operador vigiar.

## Critérios objetivos de conclusão
- Gravação ABRE sozinha quando o carro começa a andar (velocidade sustentada acima de um limite).
- Gravação FECHA sozinha quando o carro para/entra no box (velocidade baixa por alguns segundos) — sessão preservada intacta.
- Volta a abrir nova sessão quando sai de novo.
- Tela mostra GRANDE: "GRAVANDO — na pista" x "EM ESPERA — box", + GPS e motor chegando (sim/não, Hz).
- Provado com a volta real de GPS (24/05) reproduzida: o estado vira GRAVANDO quando anda e EM ESPERA quando para.
- Sem botão de iniciar/parar no fluxo. Notebook ligado + app rodando = único requisito manual.

## Leitura dos arquivos obrigatórios
- ~/.claude/CLAUDE.md: sim · docs/COCKPIT_FONTE_DA_VERDADE.md: sim
- plano-fonte das 8 fases (relatorios/plano-motor-gravacao-windows-2026-06-21.html): sim
- memórias captura (pontaaponta, gravacao-blindada-exe, checklist-pista): sim

## Plano (≤5 passos)
1. Ler integração da Central de Pista (web/teste-aparelhos/index.html) com o gravador + sinal de velocidade do GPS + display de estado.
2. Adicionar máquina de estado por MOVIMENTO no gravador/Central: ESPERA(box) <-> GRAVANDO(pista) por velocidade (liga/desliga sozinho). Reusa "encerra por silêncio" que já existe.
3. Aviso GRANDE de estado na tela (GRAVANDO na pista / EM ESPERA box) + GPS e motor chegando.
4. Testar com a volta real 24/05 (velocidade real) — provar a virada de estado; rodar os testes do gravador.
5. Abrir a Central no navegador pro Flávio ver.

## Arquivos/áreas a inspecionar
- web/teste-aparelhos/index.html (Central de Pista — lê RaceBox GPS + motor USB, usa o gravador)
- web/cockpit/session-recorder.js (gravador: abre no 1º dado, fecha por silêncio 8s, conta nGps/nMotor, estado() com hz/parado)
- web/teste-aparelhos/_validar-gravador.html (testes do gravador)

## Ambiente alvo: desenvolvimento
## Produção protegida: sim
## Autorização para produção: não
## Evidência da autorização: não recebida (é só web/dev na Central de Pista)

## Riscos
- Limiar de velocidade liga/desliga: escolher default sensato (calibrar na pista). Não cravar como verdade absoluta.
- Não publicar nada no canal de produção cockpit-bubi-live (regra dura). É só gravação local.
- Preservar o comportamento atual (abre no 1º dado, fecha por silêncio) — só ACRESCENTAR o gatilho por movimento.

## Status inicial: iniciado
