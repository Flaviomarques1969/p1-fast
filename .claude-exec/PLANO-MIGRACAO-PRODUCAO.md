# PLANO DE MIGRAÇÃO PARA PRODUÇÃO — P1 Fast (painel vivo)

> Documento VIVO. O Claude mantém atualizado a cada item que fica pronto.
> Flávio libera item por item com a frase literal **`MIGRAR PARA PRODUÇÃO: <item>`**.
> Sem essa frase, nada vai pro ar. Regra de ouro: produção é protegida.
> Última atualização: 2026-06-15 — Item 1 reaberto: backup do estoque estava bloqueado (função de sincronização não aceitava a tabela). Conserto feito em desenvolvimento; falta publicar na nuvem.

## Como funciona
- **Estados:** 🟢 NO AR · 🟡 PRONTO (aguardando sua ordem) · 🔵 EM TESTE (ainda construindo) · ⚪ A AVALIAR.
- "Produção" do app = versão oficial + app instalado no **iPhone 16 Pro Max** real.
- "Produção" da nuvem = banco/migração no Supabase + (quando houver) painel no ar (Vercel).
- Cada item tem: o que é · estado · o que falta · risco · desfazer (rollback) · frase pra liberar.

---

## 1. 🟢 Estoque unificado + backup na nuvem — NO AR 2026-06-15
- **O que é:** um estoque só (geral + de cada carro) com backup na nuvem; o estoque do carro de hoje é COPIADO pra dentro (original intacto).
- **Estado:** CONCLUÍDO. (a) Migração `0046` aplicada (tabela `estoque_item`). (b) Funções `sync` (v10) e `pull` (v4) publicadas 15/06 17:55 (autorização literal `MIGRAR PARA PRODUÇÃO: funcoes sync e pull com estoque`). (c) Os 2 itens de estoque do iPhone SUBIRAM pra nuvem — confirmado cruzando app (0 pendentes, fila vazia) × nuvem (2 itens: Sincronizador 3a marcha + Tensionador e Polia).
- **Bloqueio que existia (resolvido):** a função `sync` publicada estava na v9 de 03/06 e não aceitava `estoque_item`; os 2 itens já tinham batido no limite de 5 tentativas (dead-letter) ontem. Depois de publicar a v10, foi preciso o usuário tocar "Tentar de novo" na tela Sincronização (zera o contador e reenvia) — o app NÃO re-tenta dead-letter sozinho.
- **Desfazer:** republicar sync v9 / pull v3; rollback da `0046` no rodapé dela. A 0044 (de outra frente) NÃO foi tocada.
- **Melhoria proposta (não feita):** fazer o app re-tentar sozinho os itens dead-letter quando a condição muda (ex.: app/nuvem atualizados), pra nunca exigir toque manual. Aguarda decisão do Flávio.

## 2. 🟢 Estoque geral + Pendências (camada local)
- **O que é:** Estoque geral na Garagem, editor único com câmera, Pendências novas (contador "peguei", concluir no quadradinho, Gerenciar).
- **Estado:** NO AR no seu iPhone desde 14/06 (camada local, não usa a nuvem). Autorização registrada ("MIGRAR PARA PRODUÇÃO: estoque geral + pendências").
- **O que falta:** nada pra esta parte. (Fica unificada/com nuvem no item 1.)
- **Observação:** falta sua conferência visual no aparelho (abrir Garagem → Estoque geral e Pendências).

## 3. 🟢 Cópia oficial na nuvem (GitHub) — FEITO 2026-06-14
- **O que é:** levar o trabalho pra "versão oficial" do projeto no GitHub.
- **Estado:** INCORPORADO na versão oficial (marco `a821ddaa` "consolidacao onda 4", em cima da onda 2). Avançou 1 marco limpo, validado (empacotou OK + testes verdes), SEM atropelar a arrumação que já existia e SEM tocar painel ou banco da nuvem. Backup completo também na gaveta `backup/estoque-pendencias-unificado-2026-06-14`.
- **O que falta:** nada.

---

## 4. 🟡 Site p1tv (Central de Pista, item-3 RaceBox dono único) — PRONTO no git, AGUARDANDO PUBLISH no Vercel
> **PARA O CLAUDE DO iMAC (publish do Vercel é feito daqui):** o notebook Windows NÃO publica no Vercel (sem CLI/node/painel) — só commitou no git.
- **O que é:** `web/teste-aparelhos/index.html` (= `p1tv.vercel.app`) atualizado pro **item-3**: a página PAROU de abrir o RaceBox por BLE e passou a **ouvir o GPS da nuvem** (evento `gps`, publicado pelo `.exe` do cockpit) e repassar pro vídeo; caiu a UI de "Gravação da sessão" (o `.exe` grava agora).
- **Estado:** commit **`6de7ee81`** já na **`main`** (`consolidacao onda 5`, só o `index.html`), pushado pro GitHub em 2026-06-26 pelo notebook. **Falta só PUBLICAR no Vercel** (o auto-deploy de `main` NÃO disparou; o site no ar ainda é o de 21/jun). **Ação no iMac:** publicar o `p1tv` como você faz normalmente (o repo já tem a correção).
- **Por que é seguro/necessário:** sem o item-3 no ar, a página antiga e o `.exe` brigam pelo RaceBox (um aparelho = um central BLE). Com o item-3, o `.exe` é dono único e a página só consome o GPS da nuvem.
- **Desfazer:** `git reset` da `main` pra tag **`backup/main-pre-onda5-2026-06-26`** (= `a821ddaa`) + republicar.
- **Contexto (feito no notebook 2026-06-26, branch `sync/notebook-dia-de-pista-2026-06-23`):** Fase 1 do cockpit `.exe` (threading/nuvem/flush/RaceBox) commitada (`b6fdb976`); docs ADR-024/Amendment 7 (`6cff4f0e`); 3 botões 1-clique em `windows/cockpit/` (`IR-AO-VIVO-PRODUCAO.cmd`, `IR-AO-VIVO-TESTE.cmd`, `ABRIR-VIDEO-PISTA.cmd`). Uma **regressão de 24/06** (revertia ios/web-cockpit/supabase + Command Box Fire TV→Apple TV) foi **descartada** (backup em `git stash` no notebook).

## 5. 🟡 Fase 2 do cockpit (mensagens + IA de temperatura + memória + ajuste por carro) — INCORPORADA na linha ativa 2026-07-05, AGUARDANDO o notebook compilar
- **O que é:** as 24 mensagens simplificadas do cockpit do piloto (Fase 1) + a IA que aprende a temperatura normal do carro e avisa fora do padrão (água antes de ligar ajusta o dia) + memória por carro (o aprendizado sobrevive entre sessões) + o ajuste dos limites de alerta pelo celular (tela "Alertas" no Setup do Carro; o cockpit lê os limites de cada carro da nuvem).
- **Autorização literal:** Flávio 2026-07-05 — `MIGRAR PARA PRODUÇÃO: Fase 2 do cockpit (mensagens + IA de temperatura + memória + ajuste por carro)`.
- **Estado:** iMac INCORPOROU na linha ativa `sync/notebook-dia-de-pista-2026-06-23` por avanço direto (fast-forward) `c28a532b → 04bc72aa` (só os 13 registros da Fase 2; NÃO tocou a main, banco, Vercel nem `cockpit-bubi-live`). Prova antes do push: cérebro 411/411 verde; app iOS compila; provado nos dois lados (iMac + notebook) e visual (tela Alertas no simulador + cockpit com "Temperatura Motor Subindo" na tela do piloto). **Falta o "no ar de verdade":** o notebook alinhar a linha ativa (04bc72aa), COMPILAR o `.exe` (x64) e rodar via `IR-AO-VIVO-PRODUCAO.cmd` no carro + validar na tela 10,5".
- **Risco:** baixo. Best-effort em tudo (persistência do aprendizado e leitura dos limites do carro caem no padrão se faltar arquivo/rede). Números do Bubi (ref 62/+3/base 30/fator 0,5) são conservadores — calibrar com dado real depois (não trava).
- **Desfazer:** reset da linha ativa pra a tag `backup/sync-pre-fase2-2026-07-05` (= c28a532b) + o notebook recompila a versão anterior.

## ⚪ A AVALIAR (outras frentes — confirmar antes de marcar como pronto)
Preciso VERIFICAR (sem inventar) o que está pronto-mas-não-no-ar nestas frentes antes de listar como migrável:
- **Shift light (fundações pra pista):** construído em teste; de propósito NÃO publicado no painel (espera o dia de pista 15–16 e reconciliação). → provavelmente NÃO migrar agora.
- **Outras telas/ajustes acumulados** nos 532 registros de trabalho locais: faço uma auditoria e listo aqui, se você quiser.

> Quer que eu faça essa auditoria das outras frentes pra completar o plano? É só dizer "audita as frentes".

---

## Histórico de migrações já feitas
- 2026-06-14: Estoque geral + Pendências (camada local) → instalado no iPhone (item 2).
- 2026-06-14: Incorporação na versão oficial (GitHub) → marco `a821ddaa` (item 3).
- 2026-06-14: Estoque unificado LIGADO na nuvem → migração 0046 aplicada (tabela `estoque_item`) + app sincronizado instalado no iPhone (item 1). Falta só Flávio abrir ~1 min pro envio retroativo concluir.
