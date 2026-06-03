# Auditoria do plano da Manutenção + versão premium

**Data:** 2026-05-17
**Trigger:** Flávio pediu auditoria e quer solução super premium.
**Status:** plano v1 (`PLANO_MANUTENCAO.md`) é OK e mediano — esse documento aponta o que falta pra premium.

---

## 1. Auditoria honesta do plano v1

Onde eu fui fraco no plano de ontem:

| # | Ponto fraco do v1 | O que estava fazendo errado |
|---|---|---|
| **A** | "Apple Vision resolve 80–90%" (leitor de texto do iPhone) | Número chutado. Não testei nada. Embalagem de óleo é fácil; pastilha em caixa marrom é difícil. |
| **B** | Pneu jogado pra rodada futura | Pneu é o item MAIS crítico de pista. Não pode ficar pra depois. |
| **C** | Custo financeiro deixado pra "módulo futuro" | Quem gerencia 2 carros de competição SABE quanto gasta. Sem isso, a função é caderno bonito, não gestão. |
| **D** | Periodicidade só por km / horas / data | Carro de pista NÃO se desgasta linearmente. 1 volta de pista vale 3 km de rua na suspensão. O plano ignorou isso. |
| **E** | Modelo de visão na nuvem cortado por medo de custo | Custo real é ~R$ 0,03 por foto (3 centavos). Eu cortei sem te apresentar o número. |
| **F** | Sem painel resumo de saúde do carro | Você ia ter histórico, mas não tem "o Subaru está pronto pra correr?" em 1 olhada. |
| **G** | Pendência simples (cria → você dispensa) | Sem aprendizado. Se você sempre dispensa filtro de cabine, sistema continua reclamando pra sempre. |
| **H** | Multi-equipe (mecânico / engenheiro) ignorado | Alinhado com Fase 1 do plano mestre, mas premium pediria interfaces separadas pra mecânico lançar manutenção sem precisar do iPhone do piloto. |
| **I** | Sem rastreio de oficina / mecânico parceiro | "Quem instalou" virou texto livre. Premium guarda como entidade e mede desempenho. |
| **J** | Sem compartilhamento com terceiros | Como o mecânico vê o histórico do Subaru? "Manda print?" — fraco. |
| **K** | Backup só local | "Fica no iPhone" é frágil. Celular cai na água = perda total. Sem backup automático é amador. |
| **L** | Foto da peça antiga não foi considerada | Foto SÓ da peça nova perde metade do valor. Foto do desgaste real é o que vira inteligência. |
| **M** | Comando de voz / atalho de tela home não foi considerado | "Acabei de trocar o óleo no box" — você não vai abrir o app, achar o carro, achar o item. Atalho de voz resolve. |
| **N** | Garantia da peça não foi considerada | Cilindro falhou em 8 meses + garantia 12 meses = troca grátis. Sem rastreio dessa data, você paga de novo. |
| **O** | Sem registro de carro usado vs carro novo | Subaru não nasceu ontem. Cadê o histórico antes do P1 Fast? Premium retroage do manual / carimbo do mecânico. |

15 pontos. Meu plano v1 tem zero dos 15. Por isso ele é mediano.

---

## 2. O que vira premium — 9 saltos

### Salto 1 — Foto inteligente (não só "ler texto")

**v1:** Apple Vision lê texto na embalagem.
**Premium:** combinação de 3 camadas, executadas em cascata:

1. **Leitor de texto do iPhone** (Apple Vision) — pega 60–70% dos casos limpos. Grátis. Local.
2. **Modelo de visão na nuvem** (Claude / GPT-4 com olho) — entra quando o leitor falha **ou** quando o usuário tira foto da peça gasta sem texto. Custo: **~R$ 0,03 por foto** (três centavos). Pra você que troca peça umas 50 vezes por ano = R$ 1,50 por ano. Insignificante.
3. **Catálogo aprendido** — depois da primeira foto, sistema reconhece a mesma embalagem por correspondência visual, sem nem precisar ler de novo. Foto 2 em diante = instantâneo, sem nuvem, sem custo.

**O que isso destrava:**
- Foto da peça antiga gasta = sistema diz "pastilha em 25%, podia ter trocado antes" ou "filtro saturado, valeu trocar agora".
- Foto da nota fiscal = extrai TODAS as peças da nota de uma vez, vincula ao carro, abate do estoque, cria as trocas.
- Foto de manual ou carimbo de revisão de carro usado = importa histórico retroativo.

### Salto 2 — Periodicidade que entende pista

**v1:** trocar a cada 5.000 km ou 6 meses.
**Premium:** sistema sabe diferenciar km de rua de km de pista, porque o stint já é registrado no aplicativo.

Cada volta de pista pesa **3 km** no contador interno de desgaste (configurável por item). 1 hora de pista vale 8 horas de uso geral. Resultado: quem corre desgasta peça antes, sistema avisa antes, sem precisar você lembrar.

Plus: **cruzamento com a telemetria que já temos** — temperatura de óleo passou de 110°C por mais de 5 voltas em um stint? Sistema cria pendência: "Considerar troca antecipada — óleo sofreu em Brasília 17/04."

Isso só é possível porque o P1 Fast já registra stint + telemetria. Outros sistemas de manutenção não conseguem fazer.

### Salto 3 — Painel "Pronto pra pista" do carro

Tela única, 1 olhada, 3 segundos:

```
SUBARU 22B · pronto-pra-pista 78%

[verde 78%] [amarelo 17%] [vermelho 5%]

Em dia: óleo, freios, fluidos
Atenção: filtro de ar (90% do prazo), correia (8.500 / 60.000 km)
Urgente: pastilha traseira (em 30% — Brasília 24/05 não passa)

Próxima manutenção sugerida: 22/05 — antes do evento
- Trocar pastilhas traseiras (estoque ✓)
- Trocar fluido de freio (R$ 85 — comprar)
- Limpar filtro de ar (sem peça)
```

Esse painel responde uma pergunta: **dá pra correr no fim de semana?**

### Salto 4 — Plano pré-evento automático

Evento Brasília · 24/05 entra no calendário. Faltam 7 dias.

Sistema gera automaticamente:

- Lista de itens que **vão vencer durante o evento** (se você fizer 50 voltas, óleo passa do prazo — troca antes).
- Lista de itens que **estão no limite** (pastilha 30% — aguenta mas vai puxar).
- Lista de compras (peças sem estoque suficiente).
- Lista de serviços pra agendar com o mecânico.
- Estimativa de custo do pacote.

Vira um **checklist clicável** que vive na tela do evento. Antes só tinha "pendências" — agora tem "pendências do evento", inteligentes, geradas.

### Salto 5 — Custo do carro

Cada troca grava o custo (foto da nota fiscal preenche automático).

Painel do carro mostra:

- Gasto total no carro desde que cadastrou.
- Gasto por km / por hora de pista.
- Top 5 itens mais caros.
- Comparativo entre carros: "Subaru gasta R$ 1,80 por km de pista. Bolinha gasta R$ 0,90."
- Comparativo entre marcas: "Mobil 5W30 durou 5.200 km. Petronas 5W30 durou 4.100 km. Mobil ganhou."

Isso É premium. Quem corre vai querer.

### Salto 6 — Garantia automática

Cada troca aceita campo "garantia (meses)". Default sugerido por categoria (fluidos = sem garantia, peças mecânicas = 12 meses, peças premium = 24 meses, etc.).

Quando falha dentro do prazo, sistema avisa: "Cilindro mestre falhou em 8 meses, comprado da oficina X — exigir troca em garantia."

Pequeno detalhe, grande dinheiro recuperado em 1 ano.

### Salto 7 — Mecânico parceiro como entidade

Cadastra **Oficinas / Mecânicos**. Quando registra a troca, escolhe quem instalou.

Painel "Pessoas que cuidam dos carros" mostra:
- Mecânico Marcelo: 28 trocas, 4 retrabalhos (14%) — atenção.
- Oficina X: 12 trocas, 0 retrabalho — confiável.

E permite **compartilhar histórico** com o mecânico: 1 botão "compartilhar manutenções dos últimos 6 meses do Subaru com Marcelo" → gera link / PDF / WhatsApp. Mecânico abre, vê tudo, sabe o que foi feito.

### Salto 8 — Comando rápido (voz e atalho de tela home)

Você está no box, mão suja, acabou de trocar a vela. Não vai pegar o iPhone, achar o aplicativo, achar o Subaru, achar "vela", lançar.

Premium:
- **Atalho na tela home do iPhone:** widget "Acabei de trocar" → 1 toque → "Subaru?" → "Vela?" → registra.
- **Comando de voz** ("E aí Siri, registrar troca no P1 Fast: vela do Subaru") → cria troca pendente de confirmação.
- **Lançamento em lote pós-evento** — antes de encerrar o evento, sistema pergunta: "Alguma troca durante o evento?" e abre formulário em sequência.

### Salto 9 — Backup automático

Local É bom, mas perda do iPhone = perda total.

**Backup automático criptografado pro iCloud Drive do Flávio** (a nuvem pessoal dele, sem servidor nosso, sem custo, sem privacidade exposta).

Diário, em background, transparente. Se trocar de iPhone = restaura tudo. Custo zero pra nós, segurança total pra você.

---

## 3. Premium não-negociável (precisa estar na versão 1)

Mínimo pra ousar dizer "premium":

1. ✅ **Foto inteligente em 2 camadas** (leitor iPhone + nuvem como fallback explícito com seu visto).
2. ✅ **Painel "Pronto pra pista"** com semáforo verde/amarelo/vermelho.
3. ✅ **Pneu desde a v1** com nº de série (não joga pra futuro).
4. ✅ **Custo financeiro embutido** desde o lançamento.
5. ✅ **Cruzamento com telemetria de stint** (km de pista pesa mais que km de rua).
6. ✅ **Backup automático no iCloud Drive** (sem servidor nosso).
7. ✅ **Foto da peça antiga** entra na ficha junto com a peça nova.
8. ✅ **Plano pré-evento automático** gerado quando você cria evento no calendário.

---

## 4. Premium "fica pra rodada 2" (não trava a 1)

Sem isso a v1 ainda é premium, mas falta refino:

- Comando de voz / widget de tela home.
- Mecânico / oficina como entidade + comparativo de qualidade.
- Garantia automática com aviso.
- Catálogo aprendido (foto 2 em diante = grátis).
- Compartilhamento PDF com mecânico.
- Importação de manual / carimbo de revisão de carro usado (retroage estado).
- Análise preditiva agressiva ("baseado em 200 voltas, óleo aguenta só 3.800 km").

---

## 5. Re-cronograma premium (substitui o cronograma do v1)

Plano v1 tinha 6 blocos modestos. Versão premium = 8 blocos focados, ainda 1 sessão cada.

| Bloco | Conteúdo | Premium habilitado |
|---|---|---|
| **B1** | Tabelas + lista de itens fixos por área + tela vazia "Manutenção" no painel do carro + especificação padrão | Base |
| **B2** | Lançamento de troca COM FOTO (leitor do iPhone) + custo + foto da peça antiga + estoque −1 | Salto 1 (camada 1) + Salto 5 |
| **B3** | Camada 2 da foto (modelo de visão na nuvem) com seu visto de custo + catálogo aprendido | Salto 1 (camada 2 e 3) |
| **B4** | Periodicidade que entende pista (cruza km de stint + horas de pista + telemetria de óleo) | Salto 2 |
| **B5** | Painel "Pronto pra pista" com semáforo verde/amarelo/vermelho + 3 listas | Salto 3 |
| **B6** | Pneu com nº de série (vida em km, em voltas, posição de montagem, rotação) | Não-negociável 3 |
| **B7** | Plano pré-evento automático na ficha do evento + lista de compras + lista pra mecânico | Salto 4 |
| **B8** | Backup automático criptografado no iCloud Drive do Flávio | Não-negociável 6 |

Estimativa: **8 sessões**, 2 a mais que o v1 mediano. Vale a pena.

Saltos 6 a 9 (garantia, mecânico-entidade, voz/widget, compartilhamento, retroação de carro usado) ficam pra rodada 2 — 4–6 sessões adicionais quando você quiser.

---

## 6. Decisões pendentes (refeitas e enxutas)

Cards a abrir, em ordem:

1. **Aceita o cronograma de 8 blocos premium em vez dos 6 medianos?** (Recomendação: sim.)
2. **Modelo de visão na nuvem entra na v1, com ~R$ 0,03 por foto e visto explícito no momento ("manda pra nuvem?")?** (Recomendação: sim. Custo desprezível pra valor que entrega.)
3. **Pneu por nº de série já na v1 (4 pneus, posição, rotação) ou versão simples primeiro?** (Recomendação: já na v1.)
4. **Backup automático no SEU iCloud Drive (sua conta pessoal, sem servidor nosso) — autorizar?** (Recomendação: sim, é grátis e protege.)
5. **Painel "Pronto pra pista" vira o resumo principal do painel do carro (substitui os 6 números atuais) ou vira aba separada?** (Recomendação: aba separada na v1; substitui na v2 se você gostar.)
6. **Foto da peça antiga: obrigatória, opcional ou opcional-com-empurrão ("você quer adicionar a peça antiga?")?** (Recomendação: empurrão. Sem trava mas pede.)
7. **Custo financeiro: aparece pra você sempre, ou em sub-painel separado? (privacidade vs visibilidade)** (Recomendação: sempre, é seu carro e seu dinheiro.)

---

## 7. O que rever no plano v1

Quando você aprovar essa auditoria, eu reescrevo o `PLANO_MANUTENCAO.md` consolidando esse premium dentro dele. O v1 vira histórico em `_archive/`.

Se você rejeitar, mantenho o v1 e ignoro esse documento — sem perda de trabalho.

---

## 8. Por que isso É premium de verdade

Premium não é mais campo, mais botão, mais tela. Premium é:

- **Decisão tomada por você em 3 segundos** (semáforo verde/amarelo/vermelho).
- **Zero digitação** (foto resolve tudo, voz pra emergência).
- **Inteligência que outros não têm** (telemetria + manutenção é vantagem do P1 Fast — nenhum sistema de oficina cruza isso).
- **Dinheiro respeitado** (custo, garantia, comparação).
- **Confiança total** (backup, histórico, compartilhamento).
- **Antecipação** (pré-evento, periodicidade real, alerta antes de virar problema).

8 pontos. O v1 tinha 2.

---

**Próximo passo:** você lê, marca quais saltos topa e quais não, e eu refaço o plano oficial com o que ficou de pé. Implementação só começa depois.
