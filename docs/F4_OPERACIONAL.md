# F4 Triagem de vídeo — checklist operacional

> **Data:** 2026-05-12
> **Status do código:** entregue em PR #190 (etapas 4.2 a 4.6 + 4.1).
> **Status operacional:** alguns passos manuais na conta Daily.co e na produção do servidor ainda dependem de você.

A camada de código entregue cobre tudo. Pra capacidade ficar 100% no ar, faltam 3 checagens manuais que só você consegue fazer (acesso a conta paga + ambiente de produção).

---

## 1. Ativação da gravação na conta Daily.co

**Onde:** [dashboard.daily.co](https://dashboard.daily.co) → seu projeto → Settings → Recording.

**O que conferir:**
- [ ] Plano da conta permite gravação cloud (Pay-as-you-go, Standard ou Enterprise — ver lista no painel).
- [ ] Cloud Recording está **enabled** no nível do projeto.
- [ ] Caso o plano não permita, fazer o upgrade (custo já contabilizado no teto US$ 50/mês que você definiu).

**Por que isso é manual:** o código (`supabase/functions/stream-start/index.ts`) já solicita `enable_recording: "cloud"` em cada sala criada. Mas se a conta Daily.co não permitir cloud recording, a chamada retorna erro 402 (payment required) ou ignora o flag silenciosamente. Validação só acontece na primeira transmissão real.

**Como confirmar que está funcionando:**
1. Abrir um stint qualquer no app.
2. Voltar pro dashboard Daily.co → Rooms → procurar a sala criada (nome `p1fast-XXXXXXXX-...`).
3. Verificar que aparece um indicador de gravação ativa.
4. Encerrar o stint.
5. Voltar pro dashboard → Recordings → confirmar que a gravação aparece em ~1-2 minutos.

---

## 2. Aplicação das atualizações de banco em produção

**Pendente:**
- `supabase/migrations/0016_volta_video.sql` (F4.2 — tabela `volta_video`)
- `supabase/migrations/0017_volta_video_rls_refinada.sql` (F4.6 — permissão piloto + chefe)

**Quando autorizar:**
- [ ] Revisar o conteúdo das 2 atualizações no PR #190.
- [ ] Confirmar comigo a frase exata: `MIGRAR PARA PRODUÇÃO: 0016_volta_video.sql, 0017_volta_video_rls_refinada.sql`.
- [ ] Eu aplico via `supabase db push` e valido com consulta REST.

**Sem essa autorização, as tabelas existem só no app local e ninguém consegue gravar pendentes no servidor.**

---

## 3. Teto de gasto Daily.co (US$ 50/mês)

**Onde monitorar:** dashboard.daily.co → Billing → Usage.

**Sinais de alerta:**
- [ ] Gravações acumuladas chegando próximo do limite.
- [ ] Alguma corrida com volume muito acima da média (vários stints, vários eventos).

**O que fazer se bater:**
1. Aplicar política de retenção mais agressiva (decisão d3 atual = indefinida, pode virar 90/30 dias).
2. Limpar gravações antigas via dashboard ou via API.
3. Se quiser, posso adicionar uma rotina automática que apaga gravações marcadas como "descartada" ≥ N dias depois.

---

## Estado do código (não mexer sem necessidade)

- **`stream-start` (servidor)** — já solicita gravação cloud em cada sala.
- **`volta_video` (tabela)** — indexação 1 row por volta gravada.
- **`VoltaVideoIndexer` (app)** — captura cruzamentos da linha durante o stint, indexa no fim.
- **`TriagemVideoView` (app)** — tela de triagem após encerrar stint.
- **`TriagemPolicy` (regras puras)** — bloqueio do próximo stint.
- **`TriagemPermissao` (regras puras)** — só piloto da sessão + chefe da equipe + admin triam.

---

## Próximo gate (não bloqueia F4 mas vale anotar)

- **Etapa de "glue" da UI** — plugar `TriagemVideoView` automaticamente no fim do `StintCaptureView.finalize`. Hoje a tela existe mas não está conectada ao fluxo natural do app — abrir requer chamada explícita. Ficou pra etapa futura (não estava no escopo das 6 da F4).
- **Tocar a gravação dentro do app** — o botão "tocar" em cada volta da tela de triagem é placeholder visual. Player real (jump pra t_inicio_ms da gravação) é trabalho futuro.
