# Base Única Vista Piloto Aprovada

Data do registro: 2026-05-14
Responsável pela decisão: Flávio Marques

> **Reforço de 2026-05-14 (mesma sessão):** Flávio confirmou explicitamente, após abrir o arquivo no navegador, que **esta é a VERSÃO DEFINITIVA DE PARTIDA**. Quando ele pedir pra continuar, é desta versão que se parte. Os ajustes futuros se acumulam por cima dela.

---

## 1. Resumo executivo

Flávio definiu que a única base válida para continuidade da Vista Piloto é a versão servida originalmente em:

```
http://127.0.0.1:8866/mockup-command-box-vista-piloto.html?v=1778804383775
```

A partir deste registro, qualquer trabalho da Vista Piloto deve partir exclusivamente desta base. Estão proibidas:

- a V1 rejeitada;
- backups antigos;
- candidatos reconstruídos separados;
- versões servidas em portas alternativas (8877, 8878);
- reconstrução automática a partir de histórico;
- uso do histórico como fonte principal.

### Arquivos com nome explícito "VERSÃO DEFINITIVA DE PARTIDA"

Para facilitar localização rápida quando Flávio pedir pra continuar:

- `/Users/imac/Projetos/P1 Fast/.claude/worktrees/vista-engenheiro/_design-reference/VISTA-PILOTO-VERSAO-DEFINITIVA-PARTIDA-2026-05-14.html`
- `/Users/imac/Projetos/P1 Fast/docs/auditorias/base_unica_vista_piloto/VISTA-PILOTO-VERSAO-DEFINITIVA-PARTIDA-2026-05-14.html`

Ambas têm o mesmo SHA-256 `8095f968936de45084066c49a9932160be280ab88fdd7a1c0430f6d56ae94a30` do arquivo ativo.

---

## 2. Arquivo físico identificado

| Campo | Valor |
|---|---|
| Caminho físico ativo | `/Users/imac/Projetos/P1 Fast/.claude/worktrees/vista-engenheiro/_design-reference/mockup-command-box-vista-piloto.html` |
| Última modificação | 2026-05-14 às 20:23 (horário do macOS local) |
| Porta originalmente indicada por Flávio | 8866 |
| Status da porta 8866 no momento da auditoria | **Não estava em escuta** (verificado via `lsof -nP -iTCP:8866 -sTCP:LISTEN`) |
| Processos HTTP locais em escuta no momento da auditoria | Apenas `python -m http.server 8765` (PID 9237) |
| Diretório de trabalho do servidor 8765 | Iniciado em outra sessão; não é o servidor da Vista Piloto |
| Observação sobre porta | O servidor da porta 8866 já havia sido encerrado quando esta auditoria foi executada. Como Flávio indicou que o caminho físico provável era o arquivo dentro de `_design-reference/`, e ele é o único `mockup-command-box-vista-piloto.html` existente nesse caminho, com modificação recente (20:23 do mesmo dia), ele foi tratado como a base ativa para fins de congelamento. |

---

## 3. Hashes e métricas

Foram criadas duas cópias de proteção, idênticas ao arquivo ativo.

| Cópia | Caminho |
|---|---|
| Original (ativo) | `/Users/imac/Projetos/P1 Fast/.claude/worktrees/vista-engenheiro/_design-reference/mockup-command-box-vista-piloto.html` |
| Cópia em `_history` | `/Users/imac/Projetos/P1 Fast/.claude/worktrees/vista-engenheiro/_design-reference/_history/2026-05-14-base-unica-aprovada-flavio/mockup-command-box-vista-piloto-BASE-UNICA-APROVADA-FLAVIO-2026-05-14.html` |
| Cópia em `docs/auditorias` | `/Users/imac/Projetos/P1 Fast/docs/auditorias/base_unica_vista_piloto/mockup-command-box-vista-piloto-BASE-UNICA-APROVADA-FLAVIO-2026-05-14.html` |

### Métricas físicas

| Métrica | Valor |
|---|---|
| Bytes | 295.371 |
| Linhas | 7.194 |
| SHA-256 | `8095f968936de45084066c49a9932160be280ab88fdd7a1c0430f6d56ae94a30` |
| Blocos `id=` (total de ocorrências) | 38 |

### Validação de integridade das 3 cópias

| Arquivo | SHA-256 |
|---|---|
| Ativo | `8095f968936de45084066c49a9932160be280ab88fdd7a1c0430f6d56ae94a30` |
| `_history` | `8095f968936de45084066c49a9932160be280ab88fdd7a1c0430f6d56ae94a30` |
| `docs/auditorias` | `8095f968936de45084066c49a9932160be280ab88fdd7a1c0430f6d56ae94a30` |

As três cópias têm o mesmo SHA-256. O congelamento está íntegro.

---

## 4. Métricas de conteúdo

Ocorrências dos termos principais (busca case-insensitive sobre o arquivo congelado):

| Termo | Ocorrências |
|---|---|
| marcha | 11 |
| RPM | 56 |
| delta | 170 |
| vmin | 89 |
| apex | 128 |
| pneus | 62 |
| motor | 47 |
| câmbio (com acento) | 11 |
| cambio (sem acento) | 24 |
| óleo (com acento) | 9 |
| oleo (sem acento) | 18 |
| Stint | 194 |
| P1 Coach | 13 |
| gear | 37 |
| shift | 50 |
| cockpit | 2 |

---

## 5. Decisão operacional

A partir deste ponto, qualquer ajuste visual da Vista Piloto deve partir **somente** desta base única aprovada.

Qualquer arquivo derivado deve:

1. ser criado como cópia desta base;
2. ser nomeado de forma diferente do original;
3. preservar a base original sem alteração;
4. ser revisado por Flávio antes de virar nova base aprovada.

---

## 6. Proibições registradas

- Não usar V1 rejeitada como referência ou ponto de partida.
- Não usar candidato antigo como fonte principal.
- Não buscar uma "versão melhor" em histórico.
- Não reconstruir o arquivo por logs.
- Não mexer em produção.
- Não abrir PR sem autorização explícita.
- Não fazer commit, push, merge, pull, reset ou restore sem autorização explícita.
- Não rodar build nem npm install sem autorização explícita.
- Não usar portas alternativas (8877, 8878) como fonte de verdade.

---

## 7. Próximo passo recomendado

Ajustes pontuais, **um por vez**, sempre em **cópia derivada** desta base única.

Cada ajuste deve:

- partir do SHA-256 `8095f968936de45084066c49a9932160be280ab88fdd7a1c0430f6d56ae94a30`;
- ser feito em arquivo derivado;
- ser revisado visualmente por Flávio antes de substituir o ativo;
- ser registrado em nova entrada de auditoria caso vire nova base aprovada.

---

## 7-B. Protocolo de versionamento progressivo (decisão Flávio 2026-05-14)

A versão atual congelada é **apenas o ponto de partida**. A cada melhoria que Flávio aprovar visualmente, o registro evolui assim:

1. **Versão aprovada anterior** continua preservada com seu próprio nome e SHA-256, em `_history/` e em `docs/auditorias/base_unica_vista_piloto/`. Nada é apagado.
2. **Nova versão aprovada** vira a "melhor versão atual" (a versão definitiva mais recente). Recebe nome do tipo `VISTA-PILOTO-VERSAO-DEFINITIVA-PARTIDA-AAAA-MM-DD.html` ou `VISTA-PILOTO-MELHOR-VERSAO-AAAA-MM-DD-NN.html`.
3. **Relatório oficial é atualizado** com:
   - SHA-256 da nova versão
   - Data e hora da aprovação
   - O que mudou em relação à versão anterior (descrição curta em linguagem de gestor)
   - Link para a versão anterior preservada
4. **Memória do projeto é atualizada** para apontar para a nova versão como ponto de partida quando Flávio pedir pra continuar.
5. **Versões rejeitadas não viram base** — só viram base as que Flávio aprovar explicitamente.

### Tabela de progressão de versões

| Ordem | Data | Nome do arquivo | SHA-256 | Status | Observação |
|---|---|---|---|---|---|
| 1 | 2026-05-14 | `VISTA-PILOTO-VERSAO-DEFINITIVA-PARTIDA-2026-05-14.html` | `8095f968936de45084066c49a9932160be280ab88fdd7a1c0430f6d56ae94a30` | Histórico — substituída pela versão 02 | Ponto de partida — base congelada por Flávio em 2026-05-14 |
| 2 | 2026-05-14 | `mockup-command-box-vista-piloto-MELHOR-VERSAO-2026-05-14-02.html` | `5a1f99035e61d1afdda88f75b14e8f594f8ab2b723ae3cc80c7d76f09f06c169` | Histórico — substituída pela versão 03 | Rodada 1 de melhorias aprovada por Flávio em 2026-05-14 (resumo na seção 9 abaixo) |
| 3 | 2026-05-15 | `mockup-command-box-vista-piloto-MELHOR-VERSAO-2026-05-15-03.html` | `0d4d485e74dc20192f9ccf0401a32e516b2b9b876a82478162e2686d81d59360` | Histórico — substituída pela versão 04 | Rodada 2 de melhorias aprovada por Flávio em 2026-05-15 (resumo na seção 9 abaixo) |
| 4 | 2026-05-15 | `mockup-command-box-vista-piloto.html` + `mockup-command-box-vista-piloto-MELHOR-VERSAO-2026-05-15-04.html` | `ef5ceab27a44ae85e82a2e141aa2a48682b4acaa2ed6d1191c7bf3819935047f` | **MELHOR VERSÃO ATUAL** | Rodada 3 de melhorias aprovada por Flávio em 2026-05-15 (resumo na seção 9 abaixo) |

A cada nova aprovação, adicionar linha nesta tabela e marcar a anterior como "Histórico — substituída pela versão NN".

---

## 8. Como retomar no futuro (instrução de continuidade)

Quando Flávio pedir pra continuar a Vista Piloto, o ponto de partida é **sempre** a MELHOR VERSÃO ATUAL marcada na tabela de progressão (seção 7-B).

**Em 2026-05-15, a melhor versão atual é a versão 04:**

```
/Users/imac/Projetos/P1 Fast/.claude/worktrees/vista-engenheiro/_design-reference/mockup-command-box-vista-piloto.html
```

Cópias preservadas idênticas:
```
/Users/imac/Projetos/P1 Fast/.claude/worktrees/vista-engenheiro/_design-reference/_history/2026-05-15-melhor-versao-04/mockup-command-box-vista-piloto-MELHOR-VERSAO-2026-05-15-04.html
/Users/imac/Projetos/P1 Fast/docs/auditorias/base_unica_vista_piloto/mockup-command-box-vista-piloto-MELHOR-VERSAO-2026-05-15-04.html
```

SHA-256: `ef5ceab27a44ae85e82a2e141aa2a48682b4acaa2ed6d1191c7bf3819935047f`

Para abrir no navegador, subir servidor local na porta 8866 a partir da pasta `_design-reference/` e abrir:

```
http://127.0.0.1:8866/mockup-command-box-vista-piloto.html
```

Não procurar versão melhor. Não reconstruir. Não comparar com histórico. Partir exatamente desta base, aplicar o ajuste pedido em **cópia derivada**, e só promover a nova base aprovada após confirmação visual de Flávio.

---

## 9. Histórico de melhorias por versão

### Versão 04 — 2026-05-15 (rodada 3 de melhorias aprovada por Flávio)

Partida: versão 03 (SHA `0d4d485e…`).
Resultado: versão 04 (SHA `ef5ceab2…`), 302.335 bytes, 7.352 linhas.

**Mudanças aprovadas:**

1. **Mapa da pista — número da marcha em pé** — antes os números acompanhavam a rotação do desenho (que está girado para caber no formato do bloco), o que deixava as marchas deitadas ou inclinadas. Agora cada número recebe uma rotação contrária que o coloca em pé no sentido natural de leitura.
2. **Mapa da pista — tamanho dos números das marchas reduzido em 40%** — passou de 33 para 20 pixels (com o contorno escuro proporcional, de 5 para 3 pixels).
3. **Mapa da pista — número da marcha movido para próximo do apice** — antes ficava no ponto de entrada (lado de dentro do traçado, depois pelo lado de fora). Agora aparece próximo do apice de cada curva (ao lado do alfinete dourado), pelo lado de fora do traçado, à distância de 26 pixels da borda.
4. **Velocímetro — odômetro de plaquinhas mecânicas** — o odômetro antigo (texto simples embaixo do mostrador) foi substituído por um odômetro estilo plaquinhas mecânicas (cada dígito numa caixinha com fundo escuro e borda dourada fina, lembrando odômetros analógicos clássicos tipo VDO/fusca). Sem rótulo "odômetro" escrito — o formato visual já comunica.
5. **Velocímetro — odômetro dentro do mostrador, na parte de baixo** — posicionado na base do dial, no espaço em branco entre o "0" (canto inferior esquerdo) e a faixa vermelha do limite máximo (canto inferior direito). Substituiu a antiga marca "P1 FAST" e o odômetro de texto que estava embaixo do mostrador.

---

### Versão 03 — 2026-05-15 (rodada 2 de melhorias aprovada por Flávio)

Partida: versão 02 (SHA `5a1f9903…`).
Resultado: versão 03 (SHA `0d4d485e…`), 301.353 bytes, 7.351 linhas, 39 blocos `id=`.

**Mudanças aprovadas:**

1. **Bloco Pneus — anel verde substituído por barra horizontal** — o aro verde que ficava atrás do número da temperatura foi removido (estava confundindo). A vida útil de cada pneu agora é mostrada por uma barra horizontal embaixo, ocupando da borda externa do bloco até o centro (DE/TE à esquerda · DD/TD à direita). Quando o pneu está cheio, as duas barras de cada eixo formam uma linha contínua atravessando o bloco.
2. **Bloco Pneus — subtítulo "↑ frente" retirado** + reorganização dos espaços internos para o conteúdo respirar.
3. **Bloco Pneus — percentual e bolinha colorida da vida útil retirados** — a informação fica só na barra horizontal, mais limpo. Detalhamento numérico (94%, 91% etc.) continua disponível no aplicativo, fora do painel.
4. **Bloco Pneus — paleta de cores mais discreta** — verde musgo (em vez de verde limão saturado), laranja queimado e vermelho tijolo. A vida útil deixou de competir visualmente com as leituras críticas.
5. **Bloco Pneus — fundo da barra mais visível** — agora dá pra perceber claramente o pedaço já consumido (parte vazia da barra), com contorno marcado e tom de cinza claro. O preenchimento ainda colorido ficou com leve transparência (que se desfaz automaticamente quando o pneu entra em estado crítico, pra alerta não perder força).
6. **Bloco Pneus — revisão completa de tamanhos** — depois que o conteúdo foi reduzido, fizemos uma revisão proporcional: pressão, temperatura, etiqueta de posição (DE/DD/TE/TD), barra e área do número, tudo recalibrado para o bloco não ficar amontoado.
7. **Bloco Carro — motor/câmbio em alerta crítico não estoura mais o limite** — o brilho da pisca (vermelho ou laranja em estado quente) agora fica contido dentro do retângulo, sem vazar para fora.
8. **P1 Coach — conteúdo redesenhado para tudo caber sem cortar** — paddings e tamanhos das fontes reduzidos proporcionalmente, hierarquia visual mantida. A barra de progresso, a análise em itálico e o módulo preditivo voltaram a aparecer integralmente.
9. **P1 Coach — módulo preditivo redesenhado** — tipografia trocada de fonte técnica para Helvetica limpa; estrutura nova em 3 camadas claras: tag "ALERTA PREDITIVO" + chip do prazo crítico ("crítico em ~6 voltas") + número destaque grande ("+8°C temp motor · curva 5") + linha explicando a tendência. Barra vertical âmbar no lado esquerdo separando visualmente do resto.
10. **Bloco Passagem — título reformatado** — "PASSAGEM" e o nome da curva agora aparecem centralizados, com bom respiro entre eles, fonte maior (11px), espaçamento entre letras alargado e cor branca chapada (em vez do dourado anterior, que era menos legível).
11. **Mapa da pista — marcha de entrada em cada curva** — em cada ponto de entrada de curva, a marcha que o piloto chegou é mostrada do lado de dentro do traçado, em letra grande (33px), branca com contorno escuro fino, ficando legível independente da cor do trecho por baixo.
12. **Velocímetro — odômetro do carro adicionado** — no espaço entre o "0" do mostrador analógico e o número grande da velocidade, agora aparece "ODÔMETRO 12.347 KM". Mostra a quilometragem total do carro em qualquer pista. A divisão por autódromo fica no aplicativo, fora do painel.
13. **Checklist — só itens pendentes** — assim que um item é marcado como concluído, ele sai dessa lista. O contador ao lado de "CHECKLIST · SAÍDA" reflete só os pendentes. Os concluídos ficam disponíveis no aplicativo, em lista separada de "já realizados".
14. **Checklist — ordenação por criticidade** — obrigatórios sobem ao topo (mais críticos), adicionais ficam embaixo.
15. **Checklist — barra de rolagem dourada lateral** — quando a lista tem mais itens do que cabem, aparece uma barrinha vertical dourada no lado direito indicando que há mais conteúdo. Quando a lista cabe inteira, a barra não aparece.
16. **Checklist — etiquetas "OBRIG" e "ADIC" retiradas** — a criticidade agora é comunicada apenas pela cor da barra lateral de cada item: vermelha para obrigatório, amarela para adicional. Liberou espaço horizontal para o texto.

---

### Versão 02 — 2026-05-14 (rodada 1 de melhorias aprovada por Flávio)

Partida: versão 01 (base de partida, SHA `8095f968…`).
Resultado: versão 02 (SHA `5a1f9903…`), 296.144 bytes, 7.219 linhas, 39 blocos `id=`.

**Mudanças aprovadas:**

1. **Bloco Carro · Vivo** — título "CARRO · VIVO" removido (a referência continua no nome do bloco). Altura do bloco reduzida de 34% para 30% da altura da pista, compensando o espaço do título.
2. **Bloco Carro · Vivo em estado crítico** — não estoura mais quando motor ou câmbio entram em alerta vermelho/azul piscando: a espessura da borda é constante (não triplica mais) e o brilho fica contido dentro do bloco (não vaza pra fora).
3. **Shift Light + marcha + RPM** — virou bloco fixo no centro-topo do header (antes era um bloco extra que só aparecia se estivesse salvo na memória do navegador). Agora aparece sempre.
4. **Velocidade de atualização do Shift Light** — passou de aproximadamente 30 atualizações por segundo para 2,8 atualizações por segundo. O ciclo de rotação do motor (subida → troca de marcha → frenagem → volta a acelerar) passou de 7 segundos para 14 segundos. Fica legível para acompanhar com o aluno.
5. **Sinais "+" e "−" retirados dos números de penalidade** — Frenagem, Vmin, Passagem e Δ Acumulado de Tempo agora mostram só o número (a cor verde ou vermelha continua indicando ganhou ou perdeu).
6. **Bloco Pneus — círculo verde retirado** — o anel atrás do número da temperatura que confundia foi removido. O número da temperatura aparece limpo.
7. **Bloco Pneus — barra de vida útil horizontal embaixo de cada pneu** — DE, DD, TE, TD agora têm uma barrinha horizontal embaixo, mostrando o quanto da vida útil do pneu ainda resta (comprimento = quanto resta, cor = verde/laranja/vermelho conforme a vida).
