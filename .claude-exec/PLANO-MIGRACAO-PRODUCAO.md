# PLANO DE MIGRAÇÃO PARA PRODUÇÃO — P1 Fast (painel vivo)

> Documento VIVO. O Claude mantém atualizado a cada item que fica pronto.
> Flávio libera item por item com a frase literal **`MIGRAR PARA PRODUÇÃO: <item>`**.
> Sem essa frase, nada vai pro ar. Regra de ouro: produção é protegida.
> Última atualização: 2026-06-14 (noite).

## Como funciona
- **Estados:** 🟢 NO AR · 🟡 PRONTO (aguardando sua ordem) · 🔵 EM TESTE (ainda construindo) · ⚪ A AVALIAR.
- "Produção" do app = versão oficial + app instalado no **iPhone 16 Pro Max** real.
- "Produção" da nuvem = banco/migração no Supabase + (quando houver) painel no ar (Vercel).
- Cada item tem: o que é · estado · o que falta · risco · desfazer (rollback) · frase pra liberar.

---

## 1. 🟢 Estoque unificado + backup na nuvem — FEITO 2026-06-14
- **O que é:** um estoque só (geral + de cada carro) com backup na nuvem; o estoque do carro de hoje é COPIADO pra dentro (original intacto).
- **Estado:** NO AR. (a) Migração `0046` APLICADA na nuvem (tabela `estoque_item` criada — confirmado por REST HTTP 200 e pela lista de migrações: 0046 Local+Remoto). (b) App sincronizado INSTALADO e aberto no iPhone 16 Pro Max. Código também na versão oficial (`a821ddaa`).
- **Falta só:** você abrir o app ~1 min desbloqueado pra o envio retroativo terminar de subir o estoque pra nuvem (roda em primeiro plano).
- **Desfazer:** rollback no rodapé da `0046` (apaga só a tabela nova) + reinstalar app anterior. A 0044 (de outra frente) NÃO foi tocada.

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
- 2026-06-14: Incorporação na versão oficial (GitHub) → marco `a821ddaa` (item 3). Inclui o CÓDIGO do estoque unificado; falta só LIGAR a nuvem (item 1).
