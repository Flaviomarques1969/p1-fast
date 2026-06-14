# CONTINUAR — TRAIL-BRAKING + PASSAGEM (ponto de retomada pós-/clear, 14/06/2026)

## COMANDO PRA COLAR DEPOIS DO /clear
```
Leia /Users/imac/Projetos/P1 Fast/.claude-exec/CONTINUAR-trailbraking-passagem-2026-06-14.md e
retome do ponto exato. Rode TASK_INIT, leia os 6 protocolos do Padrão Flávio e a memória do P1 Fast
(dois caminhos). Ambiente: desenvolvimento. Produção protegida. NÃO mexer em nada que não seja P1 Fast.
```

## ONDE A GENTE PAROU (tudo pronto, falta 1 decisão sua)
As 7 fases do plano de trail-braking + passagem foram EXECUTADAS e testadas (bateria 345 ok / 0 fail).
A tela da passagem foi APROVADA pelo Flávio. Só falta UMA decisão: subir o tipo das curvas pra produção.

### O que está pronto
- FASE 0–1: classificador no app + perfil de trail por tipo (carga/distribuição até o Vmin). Testado.
- FASE 2: coluna `tipo_curva` (T0–T5/SF/ND) nas 8 curvas — migração supabase/migrations/0043_track_segments_tipo_curva.sql.
  PRONTA e CONFERIDA (aplicada e validada num banco de teste isolado e descartável: Curva 01=T5 … Vitória=SF).
- FASE 3: 56 passagens reais re-etiquetadas (freio/ápice/Vmin) — relatorios/passagens-bubi-reetiquetadas-2026-06-14.json.
  Trabalhado em CÓPIA; backup canônico intacto (~/Documents/p1fast-backup-voltas-reais/passagens-bubi-aplicadas.json).
- FASE 4: 5º marco PACE (proxy por velocidade) no enum + detector + re-etiquetagem.
- FASE 5: agente vivo ligado (main-t3000.js, guardado, persistência LOCAL); replay prova o funcionamento
  (tools/replay-classificador-vivo.mjs).
- FASE 6: bloco PASSAGEM no painel — tipo + formato de trail + marcos freio/Vmin/PACE. APROVADO 14/06.
  Cópia carimbada: _design-reference/mockup-command-box-vista-piloto-APROVADO-PASSAGEM-2026-06-14.html.

### A ÚNICA decisão aberta
Gravar o `tipo_curva` na PRODUÇÃO (nuvem fvhwltzhytpnhlqbttmd) — é o que faz aparecer pra valer no painel.
SÓ com autorização literal do Flávio: `MIGRAR PARA PRODUÇÃO: tipo_curva`.
- NÃO precisa de banco local. O app lê os dados das curvas da nuvem, não de banco no Mac.
- Se autorizar: montar PROD_RELEASE_PLAN, aplicar a migration 0043 na nuvem, conferir, reportar.

## REGRAS DURAS (não repetir erros de 14/06)
- COMMAND BOX: abrir SEMPRE pela porta 8078 (ajudante tools/atelier-server.mjs, injeta o arranjo salvo).
  NUNCA por servidor comum/outra porta (mostra layout padrão = parece que perdeu a config). NUNCA ?reset=1.
  Arranjo salvo do Flávio: _design-reference/command-box-versoes/vista-piloto-ATUAL.json.
  URL: http://localhost:8078/_design-reference/mockup-command-box-vista-piloto.html
- P1 FAST É FECHADO: não se integra com nenhum outro sistema. O banco CGF (finanças, tabelas cgf_*) que
  roda no Mac NÃO tem relação — nunca tocar, nunca citar, nunca tratar como dependência.
- Memória nova: feedback-command-box-servir-pela-8078 · feedback-p1fast-nao-integra-com-nada.

## REGISTRO COMPLETO
- Detalhe de cada fase: .claude-exec/ultima-tarefa.md (seção PROGRESSO + RESUMO FINAL).
