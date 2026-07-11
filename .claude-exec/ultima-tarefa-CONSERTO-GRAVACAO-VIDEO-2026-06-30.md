# TASK — Consertar gravação do vídeo (Osmo via Daily.co) que nunca era iniciada (30/06/2026)

> Tarefa paralela. O `ultima-tarefa.md` está com outra frente (tela de comparação de voltas) — não sobrescrever.
> Diagnóstico-base: `.claude-exec/DIAGNOSTICO-VIDEO-OSMO-NAO-GRAVA-2026-06-29.md`.

## 1. Pedido de Flávio
Após descobrir a falha (o vídeo do dia de pista 27-28/06 não gravou), escolheu "Consertar a gravação (em desenvolvimento)".

## 2. Objetivo (1 frase)
Fazer o vídeo da Osmo ser GRAVADO de verdade: habilitar gravação na sala + iniciar quando a câmera entra + parar no fim.

## 3. Causa-raiz (confirmada no código)
- `api/video/room.js` (caminho Osmo) cria sala SEM `enable_recording`.
- Ninguém chama `startRecording()` em lugar nenhum (web/ios/api/functions) — grep vazio.
- Token: `tokenBox` é `is_owner:true` (pode gravar); `tokenPiloto` não. Box = `painel.html`.

## 4. Plano (DEV, ≤5 passos)
1. `api/video/room.js`: adicionar `enable_recording: "cloud"` nas room properties.
2. `web/teste-aparelhos/painel.html` (Box/owner): ao detectar a câmera (piloto) entrar, chamar `call.startRecording()` UMA vez; parar (`stopRecording`) ao sair/fechar. Idempotente e tolerante a erro (não quebrar o ao vivo).
3. Confirmar a API correta na doc oficial do Daily (não inventar).
4. Verificar que não quebra o ao vivo; rodar smokes disponíveis.
5. Reportar com ressalva: teste REAL (gravar de fato) exige câmera + publicação no servidor (Vercel/Daily) — não testável 100% no iMac (sem DAILY_API_KEY local).

## 5. Ambiente
- DEV. Produção protegida. Autorização produção: NÃO. Não fazer deploy/push.
- `api/video/room.js` e `painel.html` rodam em produção (fam-racing) — editar LOCAL; deploy só com ordem "MIGRAR PARA PRODUÇÃO".

## 6. Riscos
- Sem chave do Daily local: teste ponta-a-ponta real não roda aqui.
- Não quebrar o ao vivo existente (que funciona).
- Indexar em `video_streams` (pra o vídeo aparecer no nosso sistema) exige time_id/credencial — fica como passo 2 documentado; o conserto agora garante a GRAVAÇÃO (arquivo fica no Daily.co).

## TASK_DONE
- Pedido conferido: sim (consertar a gravação que nunca iniciava)
- Ambiente: desenvolvimento. Produção alterada: NÃO (sem deploy/push).
- Arquivos alterados:
  1. `api/video/room.js` — sala da Osmo agora criada com `enable_recording: 'cloud'`.
  2. `web/teste-aparelhos/painel.html` — Box (owner) inicia `startRecording({type:'cloud',1280x720,25fps})` quando a câmera entra (via `garantirGravacao()` no `attach()`), confirma por `recording-started`, para por `stopRecording()` quando a câmera sai (`reavaliarGravacao`) ou a tela fecha (`beforeunload`). Idempotente e tolerante a erro.
- Validação executada: `node --check` nos 2 (OK); `npm run smoke:arquitetura` → 32 ok / 0 fail.
- NÃO validável no iMac (declarado): gravar de verdade (precisa câmera + Box aberto + deploy + chave Daily no servidor). Custo: doc Daily diz gravação = plano pago; conta é Free pay-as-you-go (pode ter custo/precisar habilitar). Indexação em `video_streams` (vídeo aparecer no app) ainda NÃO feita — o `daily-recording-hook` casa por `daily_room_name`, e o caminho da Osmo não cria a linha; é o próximo passo.
- Resultado: conserto da GRAVAÇÃO implementado e validado em sintaxe+arquitetura; teste real e indexação pendentes.
- Pendências: (1) ensaio real com câmera antes do dia de pista; (2) decisão de custo/habilitar gravação na conta Daily; (3) indexar em video_streams; (4) deploy (ordem do Flávio).

## Status: implementado em DEV; aguarda ensaio real + decisões do Flávio.
