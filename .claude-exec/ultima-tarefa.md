# Ultima tarefa — MIGRAR PARA PRODUCAO: frenagem do Command Box (vista-piloto)

## Pedido original (Flavio)
"MIGRAR PARA PRODUCAO" — apos abrir o painel do Command Box (frenagem) na 8078 e ratificar 2 decisoes.

## Objetivo (1 frase)
Colocar no ar o bloco de FRENAGEM do Command Box (vista-piloto) que esta pronto e validado em desenvolvimento.

## Criterio de conclusao
Frenagem do Command Box no ar no destino de producao correto, com rollback documentado e validacao pos-deploy real — OU bloqueio declarado com motivo objetivo.

## Confirmacao de leitura
- ~/.claude/CLAUDE.md: sim
- ~/.claude-decisoes/padroes.md: sim
- ~/.claude/FLAVIO_EXECUTION_PROTOCOL.md: sim
- ~/.claude/FLAVIO_DONE_CHECKLIST.md: existe (protocolo de done lido no EXECUTION_PROTOCOL)
- ~/.claude/FLAVIO_ENVIRONMENT_RULES.md: sim
- ~/.claude/FLAVIO_COMMUNICATION_RULES.md: existe (regras de comunicacao ja replicadas no CLAUDE.md)

## Ambiente alvo: producao
## Producao protegida: sim
## Autorizacao para producao: PARCIAL — frase recebida porem SEM o item especificado e CONTRA decisao de segurar de 15/06
## Evidencia da autorizacao: "MIGRAR PARA PRODUCAO" (sem ": [item]")

## TRAVAS IDENTIFICADAS (evidencia real)
1. A frenagem vive num MOCKUP (`_design-reference/mockup-command-box-vista-piloto.html`). AMBIENTES_P1_FAST.md
   lista "mockups" como fonte NAO oficial; ADR-023 trata o painel como prototipo/spec, nao produto final.
   STATUS.md:17 = Command Box "NAO no ar". MS-12 Box Cockpit = nao feito (STATUS.md:320).
   => Nao existe Command Box em producao pra "atualizar"; publicar = colocar um painel inteiro no ar pela 1a vez.
2. Decisao do proprio Flavio em 15/06 (memoria p1-fast-frenagem-dado-real): SEGURAR a publicacao ate o sensor
   de freio (instala 16-17/06) e/ou GPS 25 Hz. Dado atual = GPS ~1 Hz, ~9 pontos/curva, sem sensor. Painel mostra tarja "PROVISORIO".
3. Versao oficial local (main) esta 827 versoes ATRAS da oficial remota (origin/main). Publicar daqui exige cuidado, nao e um botao.

## Plano (<=5 passos) — SO apos confirmacao do Flavio
1. Confirmar com Flavio: publicar AGORA com dado provisorio (reverte o segurar) OU aguardar sensor.
2. Confirmar destino real de producao (p1t4000.vercel.app? versao oficial? mockup vira oficial?).
3. Montar PROD_RELEASE_PLAN completo com rollback.
4. Executar publicacao no destino confirmado.
5. Validacao pos-deploy real + reporte.

## Riscos
- Publicar parecer de freada baseado em dado grosso (GPS 1 Hz) que o proprio Flavio classificou como nao confiavel.
- Publicar a partir de uma versao local 827 atras da oficial.
- Mockup nao e fonte oficial; pode quebrar o conceito de governanca do projeto.

## Status inicial: BLOQUEADO aguardando decisao do Flavio (itens 1 e 2 acima)
