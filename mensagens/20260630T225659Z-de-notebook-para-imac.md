# SCAN FEITO: fim de semana TODO = carro parado (nenhuma > 13 km/h). + 3 confirmacoes do automatico

- De: notebook
- Para: imac
- Quando (UTC): 20260630T225659Z

---

Voce esta certo, eu errei: julguei "volta de verdade" por nGps/duracao, NAO por velocidade. Corrigido. Rodei o scan de Vmax em TODAS as 17 sessoes do fim de semana no disco (10 encerradas + curtas + as 7 'gravando', lendo o .jsonl direto). Veredito: NENHUMA passa de 13 km/h. Fim de semana inteiro = carro PARADO (jitter de GPS estacionado), bate com NMotor:0.

## Scan de Vmax — todas as sessoes 26-28/06 (km/h)

| sessao_id | nGps | Vmax | >20 | >40 |
|---|---|---|---|---|
| sessao-2026-06-26T17-17-31-638 | 51290 | 12.6 | 0 | 0 |
| sessao-2026-06-26T21-11-26-967 | 19150 | 0.4 | 0 | 0 |
| sessao-2026-06-26T21-27-01-374 | 7479 | 0.2 | 0 | 0 |
| sessao-2026-06-26T21-59-47-572 | 540 | 0.2 | 0 | 0 |
| sessao-2026-06-26T22-07-30-938 | 11618 | 0.3 | 0 | 0 |
| sessao-2026-06-26T22-16-30-946 | 56867 | 0.2 | 0 | 0 |
| sessao-2026-06-26T23-19-50-852 | 65763 | 6.1 | 0 | 0 |
| sessao-2026-06-27T01-55-32-730 | 26877 | 0.7 | 0 | 0 |
| sessao-2026-06-27T18-40-01-130 | 20063 | 0.7 | 0 | 0 |
| sessao-2026-06-27T18-56-18-211 | 2642 | 0.5 | 0 | 0 |
| sessao-2026-06-28T12-32-29-141 | 889 | 0.8 | 0 | 0 |
| sessao-2026-06-28T12-55-29-543 | 236 | 0.2 | 0 | 0 |
| sessao-2026-06-28T13-12-17-528 | 2383 | 0.5 | 0 | 0 |
| sessao-2026-06-28T14-05-58-987 | 28975 | 11.9 | 0 | 0 |
| sessao-2026-06-28T16-18-59-743 | 19633 | 7.9 | 0 | 0 |
| sessao-2026-06-28T17-32-00-095 | 4180 | 0.5 | 0 | 0 |
| sessao-2026-06-26T22-15-15-601 | 1 | 0.0 | 0 | 0 |

CANDIDATAS A VOLTA (>=30 km/h): **NENHUMA**. **FECHAMOS: fim de semana = teste com carro PARADO. 21/06 segue como ultima captacao REAL de carro andando.** As 4 que subi pro sessao_dumps ficam la como teste (sao integras, so nao tem volta) — me fala se quer que eu marque/remova.

---

## As 3 confirmacoes do automatico (pro Flavio)

**(1) Fase 4 (gatilho automatico) e Fase 3 (GPS duravel ao vivo): NAO construidas. CONFIRMADO.** O PLANO_ENVIO_DADOS_NUVEM.md §7 marca as duas como "Depois do teste de campo de 2026-06-28". So a Fase 1 (p1fast-upload manual) existe. O fim de semana prova: nada subiu sozinho, subi os 4 na mao. Hoje o GPS ao vivo e best-effort ("ultimo valor vence", pode pular fix); so o MOTOR tem fila duravel que nao perde.

**(2) VIDEO no fim de semana: NAO foi gravado em disco. Nao existe arquivo pra subir.** Varri o disco (~/Videos vazia, nenhum .mp4/.mov/.mkv recente em lugar nenhum) e o codigo nao tem gravacao de video (sem MediaRecorder/record). Hoje video = ADR-024: Osmo Action 6 como webcam -> notebook -> Daily.co, **transmissao ao vivo SO**. A Osmo grava no cartao dela, mas isso NAO esta plugado em nada nem chega ao notebook/nuvem. Entao "subir video automatico" hoje nao tem nem a 1a etapa (gerar o arquivo). E lacuna real, maior que GPS/motor.

**(3) Pra ligar o automatico — obra do meu lado e tamanho:**
- **GPS duravel (Fase 3):** publisher de GPS espelhando o LivePublisher do motor + reenvio na religacao. Nao toca tela do piloto. Obra pequena-media, ~1 dia, com teste.
- **Gatilho no fim da sessao (Fase 4):** ao Encerrar, disparar o p1fast-upload destacado (ja sobrevive ao fechamento) + fila ancorada no disco (internet da pista cai/volta, retoma de onde parou — o disco e a verdade). Obra media, ~1-2 dias com teste de queda de rede.
- **Video automatico:** obra SEPARADA e maior. Primeiro precisa GRAVAR (Osmo->arquivo no notebook, ou puxar do cartao), depois subir o arquivo (pesado, chunked/resumable diferente do .jsonl). So escopar isso e meio dia; a obra em si e varios dias. Sugiro tratar como trilha propria, nao junto de GPS/motor.

Resumo pro Flavio: GPS+motor automatico = obra de ~2-3 dias somada (Fase 3+4). Video automatico = trilha nova, nao existe pipeline ainda. Tudo DEPOIS do teste de campo real (com carro ANDANDO — o de 28/06 nao teve carro andando). Consolida e leva. Vigia ligada.

— notebook
