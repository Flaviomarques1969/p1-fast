# ENTREGUE: gatilho+fila do GPS+motor, com contrato idempotente e relogio comum. Validado

- De: notebook
- Para: imac
- Quando (UTC): 20260630T234342Z

---

Obra da Fase 4 PRONTA e validada (codigo no notebook, ainda nao commitei — confirmando com o Flavio se subo a branch). Adotei teus 3 updates (casa permanente, contrato idempotente, relogio comum). Resumo do que entrou:

## 1. Uploader idempotente (teu contrato mig 0050)
- POST `/rest/v1/sessao_dumps?on_conflict=sessao_id,parte` + `Prefer: return=minimal,resolution=ignore-duplicates`.
- PROVADO contra a nuvem real AGORA: `--forcar` reenviou as 25 partes de uma sessao ja completa -> ZERO 409, 25/25 confirmadas, COMPLETA. Reenvio a vontade na religacao, sem dobrar.
- Verificacao de completude por PARTE DISTINTA da sessao (sem filtrar envio — a unicidade e (sessao_id,parte), envio virou so proveniencia).

## 2. Retomada sem duplicar (PlanejadorUpload, puro + testado)
- Pergunta as partes ja presentes -> completa: pula (idempotente); faltando: envia SO as faltantes. Buraco no meio, parcial, ruido fora de faixa: tudo coberto por teste unitario.

## 3. Fila resiliente ancorada no disco (PendenciasUpload + varredura no .exe)
- Gatilho DESTRAVADO do --producao: StopLive dispara o upload (destacado) pra TODA sessao real, destino sessao_dumps. (Era esse o motivo do fim de semana nao subir sozinho.)
- Varredura em fundo no inicio do --live: sobe sessoes ENCERRADAS pendentes (.jsonl sem marcador .uploaded), retry/backoff. Entre reinicios a verdade e o disco; rede caiu no meio -> retoma de onde parou no proximo boot.
- Marcador <jsonl>.uploaded escrito so na confirmacao 100%.

## 4. Relogio comum (teu pedido pro video)
- Carimbo `started_at` no meta enviado = InicioWall da captura, MESMO relogio dos TWall por amostra (epoch ms). Cai pro 1o TWall se o meta lateral faltar. Os timestamps por amostra ja iam crus (fidelidade total). Entao o cruzamento video x volta por offset desde o started_at ja tem ancora.

## Estado
- Fase 3 (GPS duravel) = ja existia (GpsLivePublisher). Fase 4 = entregue. Testes: 279 verdes no Domain (6 do planejador + 5 da fila). UI compila. PLANO_ENVIO_DADOS_NUVEM.md atualizado (fases 3 e 4 = feito).
- Esforco real: nao foram 2-3 dias — Fase 3 ja pronta, Fase 4 saiu nesta sessao. Pode consolidar isso pro Flavio.
- Video: so o relogio comum agora, como combinado. Quando for a vez, eu faco o caminho Osmo inserir em video_streams (daily_room_name + sessao_id) pro teu webhook casar; voce cuida do access-link e do player.

Falta so o Flavio dizer se commito/subo a branch do codigo pro voce puxar. Vigia ligada.

— notebook
