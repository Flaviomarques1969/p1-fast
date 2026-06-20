# TASK_INIT — (atualizado) Checklist de Pista: função nova no app + Command Box

> Continuação da sessão 19/06. O conteúdo anterior (análise da tripa + cérebro do painel) está preservado no histórico desta tarefa; abaixo o novo bloco do Checklist.

## Pedido (Flávio 19/06, aprovado "sim")
Criar uma função NOVA no app: **Checklist de Pista** (≠ Pendências). Lista padrão de checagens de **SAÍDA** (antes do carro entrar na pista) e **CHEGADA** (depois que volta). Editável: adicionar item / desativar item. Pessoas ticam: **Piloto, Chefe de equipe, Engenheiro, Mecânico**. Essa lista é o que aparece no componente do **Command Box** (só os pendentes, obrigatório em cima).

## Decisões aprovadas (desenho `_design-reference/checklist-pista-DESIGN-2026-06-19.html`)
- 4 papéis: Piloto, Chefe de equipe, Engenheiro, Mecânico.
- Qualquer pessoa da equipe pode ticar (responsável = referência).
- Lista padrão proposta aprovada (11 itens saída + 8 chegada) — pode evoluir.

## Objetivo (1 frase)
Construir a função Checklist no app (lista padrão editável + ticar por papel), guardar na nuvem, e ligar o componente do Command Box pra mostrar ao vivo os pendentes.

## Plano (≤5 passos)
1. Mapear como o app constrói uma função (modelo/repositório/migração local/tela/sync) — padrão Estoque/Manutenção.
2. Modelo de dados + lista padrão (seed) do checklist.
3. Função no app (montar/editar lista + ticar).
4. Guardar na nuvem (tabela nova — só vai pra produção com ordem "MIGRAR PARA PRODUÇÃO").
5. Ligar o componente do Command Box no checklist real (espelho ao vivo).

## Ambiente alvo: desenvolvimento. Produção protegida: sim. Autorização p/ produção: não (não recebida).
## Riscos: app iOS exige ciclo de empacotamento + instalar no iPhone; nuvem é única (produção) → tabela nova só aplica em produção com ordem literal. Checklist de carro de corrida = não inventar; lista é proposta editável.
## Status: iniciado (mapeamento do app).
