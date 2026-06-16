# ARQUITETURA DEFINITIVA DO P1 FAST

> **Status: CANÔNICO E OBRIGATÓRIO.** Decidido pelo Flávio em 16/06/2026 (questionário de arquitetura).
> Este documento vence qualquer descrição de arquitetura em sentido contrário em outros arquivos.
> Se houver conflito com `PLANO_FASE_1.md`, `ARCHITECTURE_DECISIONS.md`, `STATUS.md` ou qualquer mockup,
> **este documento prevalece** até que o Flávio decida o contrário por escrito.

## Princípio em uma frase

O carro gera dados o tempo todo; o **notebook no carro** processa para o piloto na hora e **manda os
mesmos dados para o app na nuvem**, que processa para tudo mais. Todas as telas mostram o mesmo dado
**ao vivo, no mesmo instante**.

## As três áreas do sistema (o mapa mental)

**1) CAPTAÇÃO** — só no carro, pelos sensores (GPS, sensores, T4000, câmera Osmo 6). O dado nasce aqui.

**2) PROCESSAMENTO — em DOIS lugares:**
- **No .exe (programa do Windows) dentro do carro.** Por dois motivos: (a) **robustez** — funciona mesmo
  sem internet/sinal/transmissão, porque captura e processa ali mesmo; (b) **desempenho** — processa onde
  capturou, sem latência.
- **No app na nuvem.** O carro envia o mesmo dado pra nuvem; lá o app processa o que cada tela dele precisa.

**3) USO DAS TELAS — três telas, cada uma com sua fonte:**
- **Cockpit do piloto** → usa os dados processados pelo **.exe** (no carro).
- **App (tem várias telas dentro)** → usa os dados processados **na nuvem**, conforme cada tela.
- **Command Box** → é UMA TELA do app: mostra o que o **app processa na nuvem** (a partir da base que o
  .exe capturou e enviou pra nuvem). O notebook NÃO processa pro Command Box — fica focado no piloto.

> **Importante (decisão Flávio):** "o Command Box não calcula" = a **TV** (a superfície) não calcula. Quem
> processa pro Command Box é o **app na nuvem**. Ex.: converter GPS na posição da tela (projeção) é
> processamento do **app na nuvem** — não do notebook (que só cuida do piloto) e não da TV. Assim o notebook
> fica leve, focado no crítico do piloto, e as "consultas" do app ficam noutro nível de criticidade, na nuvem.

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

| Tela | O que é | Fonte do dado que mostra |
|---|---|---|
| **Cockpit do piloto** | O que o piloto vê no carro (no notebook Windows) | Dados processados pelo **.exe** (no carro) |
| **App do celular** | Cliente que acessa o app na nuvem; tem várias telas dentro | Dados processados **na nuvem**, conforme cada tela |
| **Command Box** | Uma TV de 32" no box (Fire TV Stick 4K Max → navegador → app na nuvem) | O **app na nuvem** processa (a partir da base capturada/enviada pelo .exe); a TV só mostra |

Nenhuma outra superfície de tela além dessas três.

## 6. O celular (app) é multifunção

O celular **acessa o app na nuvem**. Funções:

- **Planejamento de stint** — o piloto monta antes da volta (no evento ou fora). **Vai para o notebook.**
- **Ver os dados ao vivo** (tela dedicada de acompanhar a corrida).
- **Gestão** — carro, garagem, manutenção, itens, pendências.

## 7. O Command Box é só uma tela

O Command Box é a **TV de 32" do box**. **Não calcula nada** — é uma janela do app na nuvem.

**Como a TV mostra o Command Box (decisão 16/06/2026):** um **Fire TV Stick 4K Max** ligado na TV roda o
**navegador**, que abre **direto o endereço do Command Box na nuvem**. A própria TV acessa a nuvem —
**sem celular dedicado, sem espelhamento, sem ninguém "mandando" pra TV.**

**Por que mudou (do Apple TV/celular para o Fire TV Stick):**
- Antes, um celular tinha que ficar parado, dedicado, espelhando pra TV — incômodo.
- E criava um **papel a mais**: cada pessoa já tem login e usa o app; usar o Command Box exigiria mais esse
  papel. Com o Fire Stick, a TV acessa direto — **esse papel some.** Bem mais prático.

**Praticidade de acesso (a definir):** pode ser digitar o endereço, ou um **QR Code** que, lido, já abre o
Command Box na TV. **Login a definir — talvez nem precise.**

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

1. **(RESOLVIDO para o Command Box em 16/06.)** O Command Box é uma tela de **navegador (web)**: o Fire TV
   Stick abre o endereço do Command Box direto na nuvem, sem celular. Isso **adiciona uma superfície web** ao
   sistema (o Command Box), que a decisão antiga ADR-018 ("só app nativo no iPhone, sem versão de navegador")
   não previa. **O que o Flávio ainda NÃO disse:** se o app do **celular** continua nativo no iPhone ou também
   vira navegador — **não inferir**; tratar o app do celular como está (nativo, ADR-018) até ele decidir.
   Menores a definir: login do Command Box (talvez nenhum) e se usa QR Code pra abrir.
2. **Código antigo de AirPlay.** Existe um detector de AirPlay no app do iPhone
   (`ios/p1fast-ios/Sources/Sync/AirPlayDetector.swift`) feito pro conceito antigo. Ficou obsoleto com a
   mudança pro Fire TV Stick. Remover é tarefa de código separada e cuidadosa — não foi feito aqui.

3. **Lacuna de construção (NÃO é decisão em aberto).** O processamento em DOIS lugares está decidido: o .exe
   no carro (pro cockpit do piloto e pro Command Box) e o app na nuvem (pras telas do app). Um documento de
   15/06 (`.claude-exec/POLITICA-ATUALIZACAO-3-PLATAFORMAS`) descreve o sistema de HOJE como "local-first,
   nuvem só espelha" — isso é o **estado atual do código**, que ainda está **atrás** desta arquitetura (o
   processamento na nuvem, pras telas do app, ainda é a construir). É obra a fazer, não dúvida de arquitetura.

---
*Registrado em 16/06/2026. Fonte: questionário respondido pelo Flávio
(`~/Downloads/p1fast-arquitetura-respostas-20260616-125214.json`).*
