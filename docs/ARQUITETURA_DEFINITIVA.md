# ARQUITETURA DEFINITIVA DO P1 FAST

> **Status: CANÔNICO E OBRIGATÓRIO.** Decidido pelo Flávio em 16/06/2026 (questionário de arquitetura).
> Este documento vence qualquer descrição de arquitetura em sentido contrário em outros arquivos.
> Se houver conflito com `PLANO_FASE_1.md`, `ARCHITECTURE_DECISIONS.md`, `STATUS.md` ou qualquer mockup,
> **este documento prevalece** até que o Flávio decida o contrário por escrito.

## Princípio em uma frase

O carro gera dados o tempo todo; o **notebook no carro** processa para o piloto na hora e **manda os
mesmos dados para o app na nuvem**, que processa para tudo mais. Todas as telas mostram o mesmo dado
**ao vivo, no mesmo instante**.

## 1. O dado é contínuo (streaming), nunca em lote

O dado é gerado e enviado **no instante em que é colhido**, ponto a ponto. Não existe "fecha a curva,
calcula e manda o resultado". Exemplo: o piloto cruza a linha de entrada, o sensor pega a velocidade
daquele ponto e **naquele instante** o dado já sai. A curva de freada se forma ao vivo, enquanto ele freia.

## 2. As fontes de dado no carro

- GPS
- Sensores do carro
- **T4000** (módulo de telemetria — o sensor de pressão de freio que vai entrar chega por aqui)
- Câmera **Osmo Action 6**

## 3. Onde o dado é processado — em DOIS lugares

1. **Notebook Windows (programa nativo, o ".exe"), dentro do carro.** Processa os dados e mostra no
   **cockpit do piloto**. É local de propósito: latência baixa e o canal do piloto **nunca pode cair**.
   Usa também o **plano de stint** que o piloto montou no celular.
2. **App na nuvem.** O programa do notebook **envia os dados** (por 5G, Starlink, etc.) para o app na
   nuvem, que **processa conforme a necessidade** de cada função.

Os dois processam. O notebook serve o piloto; a nuvem serve todo o resto.

## 4. A nuvem tem papel duplo

- **Transporta** o dado ao vivo (canal de transmissão em tempo real — hoje `cockpit-bubi-live`).
- **Hospeda o app** — o código do app fica na nuvem, e é lá que o app processa.

## 5. As três telas do sistema (são exatamente três)

| Tela | O que é | Quem usa | Calcula? |
|---|---|---|---|
| **Cockpit do piloto** | O que o piloto vê no carro (no notebook Windows) | Piloto | Sim, no notebook |
| **App do celular** | Cliente que acessa o app na nuvem | Equipe / chefe / engenheiro / espectador | Não — a conta é na nuvem |
| **Command Box** | Uma TV de 32" no box | Equipe no box | Não — é só uma tela |

Nenhuma outra superfície de tela além dessas três.

## 6. O celular (app) é multifunção

O celular **acessa o app na nuvem**. Funções:

- **Planejamento de stint** — o piloto monta antes da volta (no evento ou fora). **Vai para o notebook.**
- **Ver os dados ao vivo** (tela dedicada de acompanhar a corrida).
- **Gestão** — carro, garagem, manutenção, itens, pendências.

## 7. O Command Box é só uma tela

O Command Box é a **TV de 32" do box**. **Não calcula nada** — é uma janela do app na nuvem.

**Como a TV mostra o app (decisão 16/06/2026):** um **Fire TV Stick 4K Max** ligado na TV roda o
**navegador**, que abre o **app na nuvem**.

> **Isto substitui** o conceito anterior de "app do iPhone no modo BOX → AirPlay → Apple TV". **Não há
> mais Apple TV nem AirPlay nem projeção/espelhamento pelo celular** no Command Box.

## 8. "Outros usos do mesmo dado"

O app na nuvem é multifunção: cada função consome o mesmo dado conforme precisa. Exemplos:

- Espectador vê a corrida ao vivo numa tela dedicada do app.
- O Command Box (TV do box) mostra os dados ao vivo.
- O engenheiro consulta os dados de suspensão e analisa.
- Gestão do carro/garagem/manutenção.

## 9. A freada — fonte hoje x futura

- **Hoje:** estimativa pela física do GPS (a desaceleração medida pelo GPS).
- **Quando o sensor de pressão de freio entrar (instalação 15-16/06/2026, chega via T4000):** a medida
  passa a ser a real, e o sistema troca o rótulo sozinho de "estimativa (GPS)" para "sensor".

## 10. O fluxo completo

```
CARRO  (GPS + sensores + T4000 + câmera Osmo 6)
  │  dados contínuos, ponto a ponto
  ▼
NOTEBOOK WINDOWS (.exe)  ── processa pro COCKPIT DO PILOTO (latência baixa, canal garantido)
  │                          + usa o plano de stint
  │  envia os mesmos dados (5G / Starlink)
  ▼
APP NA NUVEM  ── processa conforme a função; transporta ao vivo; hospeda o app
  │
  ├─► CELULAR (app)      — ver dados / gestão / planejar stint
  ├─► COMMAND BOX (TV 32")— via Fire TV Stick 4K Max (navegador → app na nuvem)
  └─► OUTROS USOS         — espectador, engenharia (ex.: suspensão), etc.
```

Tudo contínuo, ao vivo, no mesmo instante.

## Pontos em aberto (precisam de decisão do Flávio)

1. **App nativo do iPhone x app de navegador.** O Command Box passa a abrir o app pelo **navegador** do
   Fire TV Stick. Isso sugere um app acessível por navegador. Decisões antigas do projeto (ADR-018) dizem
   "app iOS nativo, sem versão de navegador (PWA)". **Precisa do Flávio confirmar** se o app continua
   nativo no iPhone (e o navegador do Fire Stick é só pra TV) ou se vira app de navegador. Até decidir,
   NÃO mexer nessa parte.
2. **Código antigo de AirPlay.** Existe um detector de AirPlay no app do iPhone
   (`ios/p1fast-ios/Sources/Sync/AirPlayDetector.swift`) feito pro conceito antigo. Ficou obsoleto com a
   mudança pro Fire TV Stick. Remover é tarefa de código separada e cuidadosa — não foi feito aqui.

3. **"A nuvem processa" muda o que está escrito hoje como "local-first".** Esta arquitetura diz que o app
   na nuvem **processa** (item 3 e 5). Mas um documento de 15/06 (`.claude-exec/POLITICA-ATUALIZACAO-3-PLATAFORMAS`),
   baseado no código real de hoje, afirma o contrário: **"local-first — cada tela calcula localmente; a nuvem é
   só espelho/observabilidade, NÃO o cérebro ao vivo".** Ou seja: o que você decidiu (nuvem processa) é uma
   **mudança** em relação a como o sistema funciona hoje, não só uma troca de palavra. **Precisa do Flávio
   confirmar a direção:** a nuvem passa a processar de verdade (mudança real, com trabalho de construção), ou
   "a nuvem processa" vale só para as funções dela (acompanhar a corrida, análise de engenharia, pós-stint),
   enquanto o caminho ao vivo do piloto continua local no notebook? Até decidir, não tratar como resolvido.

---
*Registrado em 16/06/2026. Fonte: questionário respondido pelo Flávio
(`~/Downloads/p1fast-arquitetura-respostas-20260616-125214.json`).*
