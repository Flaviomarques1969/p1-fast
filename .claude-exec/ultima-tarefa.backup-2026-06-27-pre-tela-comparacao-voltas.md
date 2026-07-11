# TASK — Testar o funcionamento do Command Box (TV do box / tela ao vivo)

> Registro anterior (canal Claude iMac↔notebook) preservado em
> `.claude-exec/ultima-tarefa.backup-2026-06-27-pre-teste-command-box.md`.

## 1. Pedido original de Flávio
"em p1 fast, o .exe no notebook com o cockpit do piloto está pronto no notebook. quero
testar o funcionamento do command box."

## 2. Objetivo (1 frase)
Provar que o Command Box (tela que mostra o carro ao vivo: bolinha na pista + voltas/ritmo/
combustível) RECEBE e EXIBE o dado processado, no iMac.

## 3. Critérios objetivos de conclusão
- Prova objetiva de que o caminho dado→nuvem→tela funciona (posição + painel).
- Servidor da tela no ar e servindo o Command Box.
- Tela aberta no navegador do iMac com a volta real do Bubi rodando.

## 4. Leitura confirmada
- `~/.claude/CLAUDE.md` — sim
- `~/.claude-decisoes/padroes.md` — sim
- Projeto: `CLAUDE.md`, `docs/COCKPIT_FONTE_DA_VERDADE.md` (referenciado), `RETOMAR-COMMAND-BOX-NA-NUVEM.md`,
  `windows/cockpit/README.md`, `relatorios/STATUS-EXE-COCKPIT-WINDOWS.html` — sim
- Memória do projeto (canal Claude, cockpit piloto) — sim

## 5. Plano executado
1. Entender o que é "command box" e onde roda (web/nuvem, alimentado pelo .exe do notebook). FEITO.
2. Rodar as 2 provas objetivas de cadeia (canal de teste, sem produção). FEITO — VERDE.
3. Subir o servidor da tela (atelier 8078). FEITO.
4. Abrir a tela no navegador com a volta real gravada do Bubi. FEITO.
5. Reportar + oferecer próximo passo (junção com o .exe do notebook ao vivo).

## 6. Ambiente
- Ambiente alvo: desenvolvimento.
- Produção protegida: sim. Produção alterada: NÃO.
- Canal usado nas provas: de teste (`cb-prova-cadeia`, `cb-prova-painel`). NUNCA o de produção `cockpit-bubi-live`.

## 7. Evidência (validação executada)
- `node tools/prova-cadeia-command-box.mjs` → VERDE: 60 GPS → nuvem (calcularPosicao) → tela
  recebeu 60 posições, 56 DISTINTAS, arco 0.004..0.997 (volta inteira). Bolinha anda.
- `node tools/prova-cadeia-painel-command-box.mjs` → VERDE: 8 voltas → cérebro na nuvem → 13
  pacotes 'painel' na tela. STINT volta 8, RITMO -0.06/volta (1:31.89 vs PB 1:31.95), COMBUST 33.44L/84%.
- Servidor: `node tools/atelier-server.mjs` na 8078, HTTP 200, `<title>Command Box · Vista Piloto</title>`.
- Tela aberta: `http://localhost:8078/?replay=23-05&speed=30` (volta real gravada do Bubi; rótulo honesto).

## 8. Limitação / próximo passo
- Testei a TELA + o caminho nuvem→tela. O dado usado é a volta GRAVADA do Bubi (simulação), NÃO
  o .exe do notebook ao vivo.
- Para testar a junção REAL .exe(notebook) → Command Box(iMac) ponta a ponta sem carro na pista:
  notebook roda o .exe em modo simulador publicando num canal de teste; eu abro a tela em
  `?canal=<canal>` e confirmo. Depende do notebook publicando (coordenar via canal Claude ou Flávio operando o .exe).
- Carro real ao vivo (C1) = dia de pista (físico).

## Status: tela do command box CONCLUÍDO E PROVADO; junção com o .exe do notebook = pendente (depende do notebook).
