# Última tarefa — Volta de DEMONSTRAÇÃO (motor+GPS) pro painel animar inteiro na web — 23/06/2026

> Backup da tarefa anterior (+Stint iOS): conteúdo anterior deste arquivo foi sobrescrito; histórico do +Stint está no registro do repositório e nas memórias do projeto.

## Pedido original de Flávio
- "caminho web. próximo passo." → "sim" (autorizou montar a volta de demonstração).

## Objetivo (1 frase)
Fazer o painel aprovado (`web/cockpit/cockpit-volta-real.html`) animar de ponta a ponta na web — inclusive a luz de marcha e os sensores do motor — usando o motor real de 21/06 encaixado por cima da volta de GPS de 24/05, marcado como DEMONSTRAÇÃO.

## Critérios objetivos de conclusão
- Painel abre na web (porta 8078) com a luz de marcha (17 luzes) e o cluster de sensores do motor (rotação, lambda, água, bateria) ANIMANDO junto com o GPS.
- Marca visível "DEMONSTRAÇÃO" na tela (não confundir com dado real).
- Versão aprovada preservada: backup congelado `_design-reference/versions/cockpit-painel-APROVADO-2026-06-22.html` intocado; app iOS (cópia própria) intocado.
- Reversível: a troca da fonte de dados é mínima e desfazível.

## Leitura dos arquivos obrigatórios
- ~/.claude/CLAUDE.md: sim
- docs/COCKPIT_FONTE_DA_VERDADE.md: sim
- memórias cockpit (volta-real-painel, app-tela-cockpit, dados-volta-real-motor-vs-gps): sim

## Plano (≤5 passos)
1. Ler como o painel carrega/anima a gravação (alinhamento tempo pista x motor).
2. Montar fixture combinada (motor real 21/06 reamostrado/encaixado sobre o GPS 24/05), mesma estrutura {pista, motor, durPista, durMotor}.
3. Apontar o painel (web) pra fixture combinada + marca "DEMONSTRAÇÃO" discreta.
4. Servir na 8078 e abrir no navegador pro Flávio ver animando inteiro.
5. Reportar; aguardar sim/não dele.

## Arquivos/áreas a inspecionar
- web/cockpit/cockpit-volta-real.html (lógica de replay/animação)
- web/cockpit/fixtures/volta-real-pista-24-05.json (GPS lap + motor quase off)
- web/cockpit/fixtures/volta-real-brasilia-2026-06-21.json (motor real, sem GPS)

## Ambiente alvo: desenvolvimento
## Produção protegida: sim
## Autorização para produção: não
## Evidência da autorização: não recebida (é só web/dev, replay de demonstração)

## Riscos
- NÃO publicar replay no canal de produção `cockpit-bubi-live` (regra dura). É só replay local de arquivo.
- Não descaracterizar o painel aprovado: design não muda; só a fonte de dados de demonstração + uma marca "demonstração".
- A volta combinada é montagem (não é uma volta real única) — deixar explícito na tela.

## Status inicial: iniciado
