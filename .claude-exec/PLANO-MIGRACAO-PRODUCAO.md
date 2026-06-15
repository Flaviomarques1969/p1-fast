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

## 1. 🟡 Estoque unificado + backup na nuvem
- **O que é:** um estoque só (geral + de cada carro) com backup na nuvem; o estoque do carro de hoje é COPIADO pra dentro (original intacto).
- **Estado:** PRONTO em teste (empacotou OK; testes verdes; tela validada). Nuvem ainda NÃO tocada.
- **O que falta pra produção:** (a) aplicar a migração `0046_estoque_unificado_sync.sql` na nuvem; (b) instalar no iPhone o app que sincroniza.
- **Risco:** baixo — só CRIA tabela nova e COPIA dados; nada é apagado/alterado.
- **Desfazer:** a migração tem rollback pronto (apaga só a tabela nova) + reinstalar app anterior.
- **Liberar com:** `MIGRAR PARA PRODUÇÃO: estoque unificado`

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
