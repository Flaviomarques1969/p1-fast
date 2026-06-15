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

## 1. 🔵 Estoque unificado + backup na nuvem — BLOQUEADO (falta publicar a função de sincronização)
- **O que é:** um estoque só (geral + de cada carro) com backup na nuvem; o estoque do carro de hoje é COPIADO pra dentro (original intacto).
- **Estado:** banco PRONTO, mas o backup NÃO acontece ainda. (a) Migração `0046` APLICADA na nuvem (tabela `estoque_item` criada). (b) App sincronizado INSTALADO no iPhone e JÁ tenta subir o estoque. (c) Código na versão oficial (`a821ddaa`).
- **BLOQUEIO ENCONTRADO 15/06 (com prova):** a função de sincronização publicada na nuvem (`sync`, versão 9 de 03/06) NÃO aceita a tabela `estoque_item` — ela rejeita tudo que não está numa lista fixa (linha 124), e `estoque_item` nunca esteve nessa lista (confirmado no histórico). Resultado: a nuvem tem **0 linhas de estoque** (conferido por dump só-leitura) e abrir o app NÃO sobe nada (é recusado). A leitura de volta (`pull`) tinha o mesmo furo.
- **Conserto FEITO em desenvolvimento 15/06:** `estoque_item` adicionado à lista da função `sync` e da `pull` (`supabase/functions/sync/index.ts` e `.../pull/index.ts`). Aditivo e reversível. Não dá pra testar tipo localmente (Deno não instalado nesta máquina); o empacotamento real ocorre no envio Supabase.
- **Falta:** (1) publicar as funções `sync` + `pull` na nuvem — **decisão de produção, espera `MIGRAR PARA PRODUÇÃO: funcoes sync e pull com estoque`**; (2) depois, você abrir o app ~1 min desbloqueado pro envio retroativo subir; (3) eu confirmo as linhas na nuvem.
- **Desfazer:** reverter as 2 linhas adicionadas e republicar a função anterior; rollback da `0046` no rodapé dela (apaga só a tabela nova). A 0044 (de outra frente) NÃO foi tocada.

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

## ⚪ A AVALIAR (outras frentes — confirmar antes de marcar como pronto)
Preciso VERIFICAR (sem inventar) o que está pronto-mas-não-no-ar nestas frentes antes de listar como migrável:
- **Shift light (fundações pra pista):** construído em teste; de propósito NÃO publicado no painel (espera o dia de pista 15–16 e reconciliação). → provavelmente NÃO migrar agora.
- **Painel do piloto / Central de pista (Vercel):** já houve publicação anterior; confirmar se há algo novo pendente.
- **Outras telas/ajustes acumulados** nos 532 registros de trabalho locais: faço uma auditoria e listo aqui, se você quiser.

> Quer que eu faça essa auditoria das outras frentes pra completar o plano? É só dizer "audita as frentes".

---

## Histórico de migrações já feitas
- 2026-06-14: Estoque geral + Pendências (camada local) → instalado no iPhone (item 2).
- 2026-06-14: Incorporação na versão oficial (GitHub) → marco `a821ddaa` (item 3).
- 2026-06-14: Estoque unificado LIGADO na nuvem → migração 0046 aplicada (tabela `estoque_item`) + app sincronizado instalado no iPhone (item 1). Falta só Flávio abrir ~1 min pro envio retroativo concluir.
