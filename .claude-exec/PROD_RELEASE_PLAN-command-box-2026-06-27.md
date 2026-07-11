# PROD_RELEASE_PLAN — Command Box (p1box.vercel.app)

Autorização do Flávio: **"MIGRAR PARA PRODUÇÃO: command box"** (2026-06-27, neste chat).

- **O que será migrado:** a tela do Command Box (Vista Piloto) com o bloco VMIN novo
  (número da mínima + Vmin/tempo/volta da melhor passagem) e a VISTA LIMPA (sem a casca de
  edição). Vai junto o pacote padrão do p1box: menu (home) e tela de comparar voltas — são
  o mesmo site publicável.
- **Origem em desenvolvimento:** `_design-reference/` (estado atual, validado no localhost).
- **Destino em produção:** projeto Vercel **p1box** (projectName "p1box") → **p1box.vercel.app**.
- **Arquivos/serviços afetados:** `dist/p1box/` (remontado por `tools/montar-p1box.mjs`) +
  publicação Vercel (`vercel deploy --prod`).
- **Banco afetado:** não.
- **Migration necessária:** não.
- **Risco de perda de dados:** não (site estático).
- **Plano de rollback:** o Vercel guarda as publicações anteriores — reverter pelo painel/CLI
  pra publicação anterior do projeto p1box. Nada é apagado.
- **Teste feito em desenvolvimento:** sim. Vmin e tela limpa validados no navegador
  (localhost:8078); testes automáticos do Vmin (9/0, 13/0, 13/0) e trava de arquitetura (32/0)
  verdes; console sem erro.
- **Validação pós-deploy:** abrir p1box.vercel.app e conferir: bloco VMIN novo presente, SEM
  casca de edição (modo edição / adicionar bloco / legenda), leiaute no lugar.
- **Janela/restrição:** agora, a pedido do Flávio.

## Ressalva honesta
Minha cópia local está muito à frente do oficial (salvamentos automáticos) e 10 atrás do
notebook. Esta publicação leva o estado LOCAL atual do Command Box. As telas vizinhas (menu,
comparar voltas) também são publicadas a partir do local. As voltas na tela seguem simuladas
(sem carro na pista) — não é parte desta migração.

## Execução (passos)
1. `node tools/montar-p1box.mjs` (remonta dist/p1box com o estado atual).
2. Conferir que dist/p1box já tem a vista-limpa.
3. `cd dist/p1box && vercel deploy --prod --yes`.
4. Abrir p1box.vercel.app e validar.
5. Reportar resultado real.

---

## RESULTADO DA EXECUÇÃO (2026-06-27)
- **NO AR:** https://p1box.vercel.app/mockup-command-box-vista-piloto.html (publicação Vercel READY).
- **Descoberta no meio:** o arranjo aprovado dos blocos morava só na memória do navegador
  (`p1fast-vista-piloto-layout-v1`), nunca foi gravado no arquivo. Por isso, em navegador
  limpo (o ar), os blocos bagunçavam. Era problema PRÉ-EXISTENTE, não da minha publicação.
- **Correção aplicada:** gravei o arranjo aprovado (de `vista-piloto-ATUAL.json`, 16 blocos,
  bate 100% com a memória do navegador) DENTRO da tela como `LAYOUT_PADRAO`. Agora a tela
  aplica o arranjo aprovado sozinha quando não há memória local. Backup:
  `.claude-exec/backup-vmin-redesign-2026-06-27/mockup-pre-layout-padrao.html`.
- **Validação no ar (visitante novo, memória limpa):** 16/16 blocos no arranjo aprovado;
  Vmin novo presente; sem curva antiga; tela limpa (sem casca de edição). Console sem erro.
- **Rollback:** Vercel guarda as publicações anteriores do projeto p1box (reverter pelo painel).
- **Ressalva de persistência:** as mudanças vivem na minha cópia local + na publicação Vercel.
  NÃO foram enviadas pro GitHub oficial (minha cópia está muito divergente; enviar atropelaria
  o notebook). p1box só é republicado por mim, então fica estável. Folding no oficial = passo
  à parte, com cuidado, quando o Flávio pedir.
