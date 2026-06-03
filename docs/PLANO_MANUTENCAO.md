# Plano da função "Manutenção" — P1 Fast

**Data:** 2026-05-17
**Autor:** Claude (planejamento sob pedido do Flávio)
**Status:** rascunho aguardando aprovação · nenhum código escrito ainda

---

## 1. O que essa função vai fazer

Registrar **trocas/manutenções de itens do carro** com data, foto e especificação — e a partir disso:

1. Saber, a qualquer momento, o estado de cada item do carro (último óleo, última pastilha, última correia, etc.).
2. Gerar **pendência automática** quando o item passar do prazo (km ou meses).
3. Guardar a **especificação padrão por carro** ("o Subaru usa óleo Mobil 5W30 sintético"), pra não comprar errado.
4. Permitir lançamento **rápido pela foto da embalagem** — você fotografa, o aplicativo lê e preenche; você só confirma.

Em uma frase: substitui o caderninho da prateleira da oficina.

---

## 2. De onde isso veio (origem do pedido)

No áudio de 2026-05-10 (`docs/audit-2026-05-10/respostas-flavio.json`) você cravou o pedido em três partes:

> "tira uma foto da peça, o número de série, diz o que é e separa por área, elétrica, motor, câmbio, suspensão e por aí vai" → **isso virou a função Estoque, entregue 2026-05-17.**
>
> "a gente informa quando fez a troca do óleo de câmbio, do motor, etc., filtro. e aqui a gente informa qual é o periodo de cidade [periodicidade], porque quando aquilo acontecer, já vai uma pedência no sistema que precisa ser feita." → **É essa função. Manutenção.**
>
> "a gente também informa por carro quais são as especificações, qual que é o óleo que a gente usa, qual que é o óleo de câmbio, qual é o filtro que a gente usa para ter a especificação desses elementos para fazer sempre o certo." → **Especificação padrão por carro. Cabe dentro da Manutenção.**

Estoque + Manutenção formam o par. Estoque diz **o que você tem**; Manutenção diz **o que você usou e quando vai precisar trocar de novo**.

---

## 3. Como conversa com o que já existe

| Função existente | Como Manutenção encaixa |
|---|---|
| **Estoque** (Garagem → Peças) | Quando você registra uma troca, abate −1 da peça correspondente no estoque (se ela estava cadastrada lá). Se não estava, oferece "cadastrar agora?". |
| **Carro** (Garagem → painel do carro) | O painel do carro ganha bloco "Manutenção" com data da última troca de cada item crítico (óleo motor, óleo câmbio, freio, suspensão, correia). |
| **Pendências** (já existe em `PendenciaRepository`) | Periodicidade vencida vira pendência automática vinculada ao carro. Aparece nos lugares onde pendências já aparecem hoje (Home, detalhe do evento). |
| **Eventos** | Antes de um evento no calendário, sistema avisa: "Subaru tem 3 manutenções vencidas pra esse dia." |

Nada precisa ser remexido nessas funções existentes — só extensões.

---

## 4. Lista de itens cobertos

Reuso das **14 áreas já cadastradas no Estoque** (`PecaArea` enum). Dentro de cada área, uma lista pronta de itens trocáveis. Você escolhe na lista; se faltar algo, "+ Outro item" no fim.

| Área | Itens trocáveis típicos |
|---|---|
| **Motor** | Óleo do motor · filtro de óleo · velas · cabos de vela · bobinas · correia dentada · tensor · polia · juntas · coxim |
| **Câmbio** | Óleo do câmbio · juntas · retentor |
| **Embreagem** | Disco · platô · rolamento · cilindro mestre · cilindro escravo |
| **Suspensão** | Amortecedores (diant/tras) · molas · batentes · bandejas · buchas · bieleta · barra estabilizadora · pivô |
| **Freios** | Pastilhas (diant/tras) · discos (diant/tras) · lonas · tambores · flexíveis · fluido de freio · cilindro mestre |
| **Direção** | Caixa · bomba (se hidráulica) · fluido · cremalheira · ponteiras · terminais · coluna |
| **Elétrica** | Bateria · alternador · motor de partida · sensores · fusíveis · cabos |
| **Refrigeração** | Líquido de arrefecimento · radiador · bomba d'água · termostato · mangueiras · ventoinha |
| **Escape** | Coletor · catalisador · silenciador · sonda lambda |
| **Carroceria** | Adesivos · vidros · espelhos |
| **Pneus** | Pneu (com nº de série, conforme audit 2026-05-10) · calibração inicial |
| **Rodas** | Roda · parafusos · espaçadores |
| **Ferramentas de manutenção** | Não se aplica (ferramenta não é trocada) |
| **Acessórios** | Cinto · banco · santantônio · extintor · botão corta-corrente · capacete (validade) |

A lista pode crescer conforme você usar — não trava em nada fixo.

---

## 5. O que cada troca registra

Cada lançamento de manutenção guarda:

- **Data** da troca (default = hoje)
- **Carro** (default = o carro ativo no aplicativo)
- **Item** (área + item específico da lista)
- **Peça aplicada** — vinculada ao estoque, se estava lá; ou texto livre
- **Marca / modelo da peça nova** (extraído da foto, você confirma)
- **Especificação técnica** — viscosidade do óleo, dureza da pastilha, etc. (extraído da foto)
- **Quem instalou** — campo livre (você, mecânico X, oficina Y)
- **Quilometragem** do carro na troca
- **Horas de uso** acumuladas (relevante pra carro de pista, onde km é pouco confiável)
- **Foto(s)** da embalagem / peça nova
- **Foto(s) opcional(is)** da peça antiga (pra mostrar desgaste)
- **Observação** (campo livre)
- **Próxima troca prevista** — por km, por horas, ou por data (calculado automaticamente a partir da periodicidade do carro)

---

## 6. Fluxo de uso na tela

### Onde mora no aplicativo

**Garagem → painel do carro → aba "Manutenção"** (nova).

Não vai pra Cadastros, porque é histórico vivo, não cadastro estático.

### A tela

Linha do tempo invertida (mais recente em cima). Cada linha é uma troca:

```
┌─────────────────────────────────────────────────────┐
│ 12 mai · 12.430 km                                  │
│ Óleo do motor · Mobil 1 5W30 sintético              │
│ Próxima: 17.430 km (em ~5.000 km)                   │
│ [foto pequena da embalagem]                         │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│ 05 abr · 12.180 km                                  │
│ Pastilhas dianteiras · EBC Yellow Stuff             │
│ Próxima: por desgaste visual                        │
│ [foto]                                              │
└─────────────────────────────────────────────────────┘
```

No topo da aba:
- Botão grande **"+ Registrar troca (foto)"** — câmera abre direta.
- Botão menor **"+ Registrar troca (manual)"** — formulário em branco.
- Filtro por área (Motor, Freio, Suspensão…).

### Sub-aba "Especificação padrão"

Lista do que o carro **usa por padrão**:

- Óleo motor: Mobil 1 5W30 sintético — 4 L
- Óleo câmbio: Petronas Tutela 75W90
- Filtro de óleo: Tecfil PSL 950
- Pastilha diant.: EBC Yellow Stuff DP41210R
- Líquido arrefecimento: Paraflu 11 (concentrado 1:1)
- (etc.)

Esse cadastro é o "padrão pra fazer certo" que você pediu.

Quando você registra uma troca, o aplicativo já sugere a especificação padrão — é só confirmar.

---

## 7. Foto vira dado — como funciona

### Recomendação técnica

**Recomendação:** dois estágios. Estágio 1 = leitor de texto do próprio iPhone (Apple Vision, embutido no celular, sem internet, sem custo). Estágio 2 = se o estágio 1 não der certeza, manda a foto pra um modelo de visão na nuvem (modelo de inteligência artificial que lê imagem) só nessa hora.

**Por quê:** o leitor do iPhone resolve 80–90% dos casos de embalagem industrial (Mobil, Bosch, EBC, Tecfil) porque vem com texto grande e contrastado. Os 10–20% que falham (caixa muito refletiva, embalagem amassada, foto torta) caem no plano B.

**Impacto prático:** lançamento típico vira "fotografou → confirmou 3 campos → salvou", em 10 segundos. Sem digitar nada.

**Risco:** modelo na nuvem custa dinheiro (centavos por foto, mas não é zero) e exige conexão. Por isso só entra como fallback, e só com o seu visto na hora ("Não consegui ler, posso mandar pra nuvem? Sim / Não").

**Próximo passo:** confirmar com você no bloco B5 do cronograma se topa esse fallback ou se prefere "se não ler, peço pra digitar".

### O que extraímos da foto

| Campo | Confiabilidade do leitor do iPhone |
|---|---|
| Marca (Mobil, Bosch, EBC…) | Alta |
| Modelo / código (5W30 / DP41210R) | Alta |
| Especificação técnica (API SN, DOT 4) | Média |
| Volume / quantidade (4L / 250mL) | Alta |
| Número de série (pneus) | Variável (depende da gravação) |
| Data de fabricação | Baixa-Média |

Tudo extraído aparece como sugestão na tela — você confirma item por item ou edita.

A foto fica salva no banco de fotos do aplicativo (já temos isso pro Estoque).

### O que NÃO vamos prometer

- Reconhecer foto da peça **antiga já instalada no carro** (raramente tem texto legível).
- Identificar a peça por aparência (sem texto) — exige modelo treinado caro.
- Funcionar bem com foto de tela / catálogo / nota fiscal — entra como manual.

---

## 8. Periodicidade e pendência automática

Cada item da **especificação padrão** ganha uma regra de periodicidade:

- "Trocar a cada X km"
- "Trocar a cada Y meses"
- "Trocar a cada Z horas de uso"
- "Trocar por desgaste (sem prazo automático)"
- Combinação: "o que vencer primeiro"

Defaults sugeridos pelo aplicativo (você ajusta):

| Item | Default |
|---|---|
| Óleo motor sintético | 5.000 km **ou** 6 meses |
| Óleo motor mineral | 3.000 km **ou** 4 meses |
| Filtro de óleo | junto com o óleo |
| Filtro de ar | 10.000 km |
| Filtro de combustível | 20.000 km |
| Velas convencionais | 20.000 km |
| Velas irídio/platina | 60.000 km |
| Pastilha de freio | por desgaste |
| Fluido de freio | 24 meses |
| Líquido arrefecimento | 24 meses ou 40.000 km |
| Correia dentada | 60.000 km **ou** 5 anos |
| Correia acessórios | 60.000 km |
| Pneu | por desgaste |
| Bateria | 24 meses |

### Como vira pendência

Quando a periodicidade vence (km/horas/data passa do limite previsto), o sistema:

1. Cria uma **pendência** automaticamente no carro, no padrão das pendências que já existem hoje.
2. A pendência aparece em todos os lugares que pendências aparecem (Home, evento, painel do carro).
3. Você pode **dispensar** (fora do prazo mas tô levando assim mesmo) ou **resolver** (vou trocar agora → abre o formulário de troca).

Ciclo fechado: troca → registra → calcula próxima → cria pendência → você troca de novo → registra.

---

## 9. O banco por trás (linguagem leve)

3 tabelas novas no banco local do iPhone (mesmo padrão das que já existem):

| Tabela | O que guarda |
|---|---|
| `manutencoes` | Cada lançamento de troca — data, carro, item, foto, km, próxima |
| `manutencao_especificacoes` | Especificação padrão por carro (qual óleo, qual filtro, etc.) — uma linha por item, por carro |
| `manutencao_periodicidades` | Regra de quando precisa trocar de novo — vinculada à especificação |

Aproveitamento: a tabela `pecas` (do Estoque) ganha um campo opcional `manutencao_referencia` pra vincular peças que são padrão de uso (ex.: a peça "Filtro Tecfil PSL 950" no estoque sabe que ela é o filtro padrão do Subaru).

A pendência gerada vai pra tabela `pendencias` que **já existe** — só adicionando origem "manutenção_vencida".

**Não vamos subir pro servidor Supabase nessa primeira versão** — fica local, igual o Estoque ficou. Decisão futura se vai pro servidor.

---

## 10. Plano de execução em blocos

Sugestão de 6 blocos. Cada um instala no iPhone e você testa antes do próximo. Nenhum bloco depende de internet ou de pacote pago.

| Bloco | Conteúdo | Estimativa |
|---|---|---|
| **B1** | Tabelas + lista de itens fixos por área + tela vazia "Manutenção" no painel do carro | 1 sessão |
| **B2** | Especificação padrão por carro — sub-aba com cadastro manual de óleo / filtro / etc. (sem foto ainda) | 1 sessão |
| **B3** | Lançamento manual de troca — formulário, lista cronológica, vínculo com estoque (−1 quando aplicável) | 1 sessão |
| **B4** | Foto da embalagem com leitor do iPhone (Apple Vision) — extração de marca / modelo / spec, você confirma | 1–2 sessões |
| **B5** | Periodicidade — regra por item + recalculo da próxima troca + criação automática de pendência | 1 sessão |
| **B6** | Painel do carro mostra "última troca de óleo / freio / suspensão" no bloco resumo, alerta antes de evento | 1 sessão |

Total: **6–7 sessões**. Pode ser quebrado se você quiser uma versão mínima rodando no iPhone antes de tudo (B1+B3 já entrega "registrar e ver histórico", o resto é refino).

Fallback pra modelo de visão na nuvem (estágio 2 do reconhecimento) **fica fora desse plano inicial** — só entra se o leitor do iPhone for insuficiente na prática. Não vou prometer agora algo que custa dinheiro recorrente.

---

## 11. Riscos e pontos de atenção

| Risco | Mitigação |
|---|---|
| Carro de pista usa **horas**, não km — odômetro pode estar quebrado, congelado ou irrelevante | Aceitar km, horas, ou data — qualquer dos três fecha a regra |
| Periodicidade default vai estar errada pra algum carro (Subaru tem manual diferente do Bolinha) | Defaults são só sugestão. Cadastro permite editar tudo. |
| Foto da embalagem nem sempre fica boa (oficina escura, mão suja) | Plano B = digitar manual. Foto não bloqueia nada. |
| Pode acumular muita pendência velha e poluir a tela | Botão "marcar como ignorada" + pendências de manutenção em destaque visual separado das pendências de stint |
| Você troca uma peça e esquece de registrar → estoque fica errado | Ao iniciar stint, sistema pergunta passivamente: "Alguma troca desde o último stint?" (opt-in, fácil de pular) |
| Pneus por número de série não são fáceis de gerenciar (4 pneus, números diferentes, rotação) | Pneu vira caso especial em rodada futura. Nessa primeira versão, "Pneu" é um item simples; gestão por série fica pra depois |

---

## 12. Decisões pendentes (pra você, em cards)

Quando você aprovar o plano, abro um card de cada vez pra fechar:

1. **Tela única ou duas abas?** Manutenção e Especificação padrão na mesma tela com duas abas, ou cada uma em lugar separado. (Recomendação: duas abas dentro do painel do carro.)
2. **Defaults de periodicidade já pré-carregados ou em branco?** (Recomendação: pré-carregados com base na tabela acima — você só edita o que destoa.)
3. **Foto da embalagem é obrigatória ou opcional?** (Recomendação: opcional. Você quase sempre vai querer, mas trocar no meio do treino sem o aplicativo na mão precisa de saída manual.)
4. **Pendência automática vinculada ao evento mais próximo ou solta no painel do carro?** (Recomendação: solta no painel, e o detalhe do evento pega as pendências do carro participante. Igual já faz hoje.)
5. **Modelo de visão na nuvem como fallback do leitor do iPhone — autorizar ou não?** (Recomendação: deixar fora dessa versão e ver na prática se o leitor do iPhone resolve. Se você quiser, autoriza depois.)
6. **Quando subir pro servidor Supabase?** (Recomendação: deixar local por enquanto. Decidir depois junto da decisão de subir o Estoque.)

---

## 13. O que esse plano NÃO cobre (consciente)

- **Custo financeiro** de cada peça — fica pra um módulo futuro de gestão financeira do carro.
- **Quem comprou / nota fiscal** — não tem leitura de nota fiscal nessa versão; campo livre "quem comprou" no formulário.
- **Inteligência preditiva** ("baseado no seu uso de pista, óleo vai durar só 4.000 km") — fica pra quando tivermos dados de stints reais consolidados.
- **Telemetria do óleo** (temperatura, pressão) — sai pelo T4000 quando ele estiver integrado, vira validação de quando trocar.
- **Multi-equipe** (engenheiro / mecânico abrem manutenção pelo aplicativo deles) — Fase 1 é piloto-só, conforme `PLANO_FASE_1.md`.

---

## 14. Como esse documento conversa com o plano mestre

`docs/PLANO_FASE_1.md` continua vencendo em qualquer disputa de arquitetura. Manutenção não muda nada do que já está fechado em ADRs (1 ao 25). É uma função nova no aplicativo iOS, fora do caminho crítico do cockpit do piloto / Command Box.

Se algo aqui contradiz o plano mestre, o plano mestre ganha — me avise que reescrevo.

---

**Próximo passo proposto:** você lê esse plano, me diz "fechado" (ou aponta o que mudar). Aí abro o primeiro card de decisão (item 1 da lista acima) e a gente vai destravando um a um. Implementação só começa depois que os cards estiverem fechados.
