# TASK_INIT — Integração notebook → sistema (3 pernas) — 2026-06-16

## Pedido original (Flávio, esta sessão)
Fazer a integração do notebook com o sistema. Conceito ditado por ele:
- Notebook Windows (na pista) colhe GPS (RaceBox) + sensores T4000 + câmera Osmo 6, processa o básico rápido pro piloto e ENVIA pro sistema.
- O sistema (nuvem) guarda histórico e processa mais fundo (visão de engenheiro, mais detalhes).
- A integração serve 3 pernas: (1) AO VIVO no app do celular; (2) AO VIVO no Command Box (transmitido do app); (3) HISTÓRICO na nuvem pra consulta posterior — estudo, análise, review.
- Flávio respondeu "ok" ao caminho "fechar o envio do notebook".

## Objetivo (1 frase)
Deixar a camada central — o "sistema" na nuvem — pronta pra receber o ao vivo, distribuir pras frentes e gravar o histórico pra review; é a peça que liga as 3 pernas e que dá pra construir e PROVAR a partir do Mac, sem depender do T4000 físico nem do app Windows.

## Critérios objetivos de conclusão
1. A nuvem recebe amostras ao vivo e grava em histórico (continuidade, não efêmero).
2. Existe forma de rever a sessão depois (review/estudo/análise).
3. Provado com DADOS DE TESTE claramente marcados como teste (nunca misturados com reais).
4. Testes automáticos rodados com saída real.
5. Nada em produção sem autorização literal.

## Leitura confirmada
- ~/.claude/CLAUDE.md: sim
- ~/.claude-decisoes/padroes.md: sim (vazio — 0 decisões)
- ~/.claude/FLAVIO_EXECUTION_PROTOCOL.md: sim
- ~/.claude/FLAVIO_DONE_CHECKLIST.md: sim
- ~/.claude/FLAVIO_ENVIRONMENT_RULES.md: sim
- ~/.claude/FLAVIO_COMMUNICATION_RULES.md: sim
- Projeto: CLAUDE.md, AMBIENTES_P1_FAST.md, docs/PLANO_FASE_1.md (seções envio/MS), ARCHITECTURE_DECISIONS (via CLAUDE.md): sim

## Achado de rumo (ADR-023 + PLANO_FASE_1.md)
- Produto final do cockpit/envio do notebook = app Windows nativo (WinUI 3 + C#). O `web/cockpit/` JS é protótipo/spec, NÃO produto final.
- Envio do MOTOR (T4000) pro sistema = MS-9.5 (publisher Realtime em C# no Windows). Depende de captura real do CAN do T4000 (MS-9.1/9.7 = "Aqui, Flávio", bancada) e hoje o aparelho é T3000.
- Logo: o "coração" do envio não é construível/provável a partir do Mac — depende de Windows + hardware T4000, do lado do Flávio.
- O que É construível e provável do Mac: a camada de NUVEM (Supabase: tabelas de histórico, Edge Functions de ingestão, canais ao vivo) — neutra de plataforma, central pras 3 pernas.

## Plano (≤5 passos)
1. Mapear código exato da nuvem: supabase/functions (ingest, pull), supabase/migrations (tabelas de histórico), web/cockpit/cloud-bridge.js, tools/ — o que já grava, o que falta.
2. Definir a peça da nuvem que fecha gravação contínua + distribuição ao vivo + base de review.
3. Construir em DESENVOLVIMENTO (sem tocar produção).
4. Provar com dados de teste marcados + testes automáticos (saída real).
5. Mostrar no navegador e reportar no formato TASK_DONE.

## Áreas a inspecionar
supabase/functions/{ingest,pull}, supabase/migrations/*, web/cockpit/cloud-bridge.js, tools/listen-stream.mjs, tools/monitor-bubi-live.html, ios (storage de longo prazo / TelemetryUploader).

## Ambiente
- Ambiente alvo: desenvolvimento
- Produção protegida: sim
- Autorização para produção: não
- Evidência da autorização: não recebida

## Riscos
- Produto final é iOS/Windows — não provável do Mac (provo só a camada nuvem/web).
- Coração T4000→sistema depende de hardware (lado Flávio).
- Nunca misturar dado de teste com dado real (AMBIENTES_P1_FAST §dados).
- Não trabalhar no protótipo JS como se fosse produto final (ADR-023) sem deixar claro.

## Status inicial: iniciado
