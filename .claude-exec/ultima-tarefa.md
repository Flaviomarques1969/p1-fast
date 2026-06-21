# Última tarefa — P1 Fast (21/06/2026, tarde)

## 1. Pedido original do Flávio
"os dados foram obtidos hoje no notebook. teste as funções da tela de cockpit com os dados colhidos."

## 2. Objetivo (1 frase)
Rodar as funções reais do cérebro do cockpit contra a sessão real colhida hoje (21/06) e relatar honestamente o que cada uma produziu.

## 3. Critérios objetivos de conclusão
- Cada função do cockpit (velocidade, painel/vivo, coach, preditivo) foi exercida OU foi declarado por que não pôde ser.
- Resultado de cada função reportado com número real, sem inventar.
- Qualidade dos dados de hoje caracterizada (o que veio bom, o que veio zerado/lixo).

## 4. Confirmação de leitura
- ~/.claude/CLAUDE.md: sim
- ~/.claude-decisoes/padroes.md: sim
- ~/.claude/FLAVIO_EXECUTION_PROTOCOL.md: sim
- ~/.claude/FLAVIO_DONE_CHECKLIST.md: sim
- ~/.claude/FLAVIO_ENVIRONMENT_RULES.md: sim
- ~/.claude/FLAVIO_COMMUNICATION_RULES.md: sim

## 5. Plano (<=5 passos)
1. Caracterizar a sessão de hoje (motor + GPS). [FEITO]
2. Escrever um teste fora do ar que importa os módulos REAIS do cérebro.
3. Alimentar os dados de hoje em cada função e capturar a saída.
4. Comparar velocidade calculada (GPS) vs velocidade do próprio GPS (verificação).
5. Relatar por função: funcionou / não pôde + motivo.

## 6. Arquivos/áreas a inspecionar
- .claude-exec/dados-pista/sessao-2026-06-21-1140-brasilia-COMPLETA.json (dados reais)
- web/command-box/cerebro/*.js (funções do cockpit)

## 7. Ambiente alvo: desenvolvimento
## 8. Produção protegida: sim
## 9. Autorização para produção: não
## 10. Evidência da autorização para produção: não recebida
## 11. Riscos: nenhum (só leitura dos dados + teste fora do ar; não toca canal ao vivo nem nuvem)
## 12. Status: iniciado

---
---

# HISTÓRICO — tarefa anterior (preservado)

# Tarefa: Plano 3 dias — captura T4000+GPS+vídeo gravando ACESSÍVEL no notebook

## Pedido original (Flávio, via orquestrador)
Apurar a verdade (só evidência) sobre por que os testes de pista 20-21/06 se perderam e
montar PLANO DE 3 DIAS para o app do notebook Windows capturar T4000 (motor) + GPS + vídeo
do Osmo 6, gravando de forma GARANTIDA e ACESSÍVEL (Flávio precisa pegar o dado depois).

## Objetivo (1 frase)
Garantir que toda sessão de pista fique salva e recuperável pelo Flávio em até 3 dias,
priorizando o caminho mínimo do dado garantido antes de qualquer enfeite.

## Critério de conclusão
Plano realista de 3 dias com: diagnóstico provado, buraco principal, tarefas por dia com
critério de pronto, decisões que dependem do Flávio, riscos.

## Ambiente: desconhecido (trabalho = DEV; nuvem PROD consultada SÓ leitura)
## Produção protegida: sim | Autorização produção: não recebida
## Status: concluído (apuração + plano)

## Evidência coletada (somente leitura)
- Gravador local: MD5 idêntico 504b68f0... nas 2 telas; testes 43/0 e 11/0 OK.
- session-recorder.js sem nuvem (grep supabase/fetch/upload = EXIT 1, zero).
- main-t3000.js NÃO chama telemetry_samples/ingest/blob (EXIT 1). Só publishSample (volátil),
  gravarVoltaReal (só resumo), RecCockpit.motor (local 10Hz cru, novo 20/06).
- cloud-bridge.js: "sem persistência" + throttle nuvem 5 Hz.
- Central (teste-aparelhos): motor via onCarSample = broadcast nuvem 5Hz; GPS taxa cheia.
- .sln só tem Domain/Tests/LiveDemo (UI e T4000Capture fora do build).
- NUVEM PROD: sessão recente 20/06 ~3s carro nulo; nenhuma 21/06; telemetry_samples e voltas
  da 20/06 vazias; video_streams */0 (zero gravações de sempre).
- api/video/room.js (caminho Osmo) SEM enable_recording. stream-start (iPhone) tem, mas é
  o caminho descontinuado (ADR-024) e depende de plano pago Daily.
- resgate.html (21/06) lê os 2 bancos e baixa arquivo — corrige export-só-console, mas é novo.
- git: nada gravava IndexedDB antes de 20/06 (busca vazia). Causa-raiz provada.
