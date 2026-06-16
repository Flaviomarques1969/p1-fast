# Política de atualização consistente entre as 3 plataformas

Data: 2026-06-15
Plataformas: (1) Notebook Windows — .exe nativo (C#/.NET 8); (2) iOS — app P1 Fast (Swift);
(3) Command Box — TV 32" via Fire TV Stick 4K Max rodando o navegador, que abre o app na nuvem
(atualizado 16/06/2026 — ver docs/ARQUITETURA_DEFINITIVA.md).
Base: levantamento do código real (não suposição). Evidências com caminho:linha abaixo.

## Diagnóstico real (o que o código mostra)

- NÃO existe "análise central na nuvem" no caminho ao vivo. Cada tela CALCULA LOCALMENTE
  (local-first, ADR-003). A nuvem (canal `cockpit-bubi-live`) é ESPELHO/observabilidade, não o
  cérebro. Evidência: `docs/FONTE_DADOS_AO_VIVO.md:11-29`; `web/cockpit/cloud-bridge.js:6-10`
  ("se a nuvem cair, painel continua local").
- A mesma lógica (luz de marcha, alertas, detecção de trecho, delta, parser, mensagens) está
  REESCRITA em 3 linguagens: JS (`web/cockpit/`, `src/`), Swift (`ios/p1fast-core/`), C#
  (`windows/cockpit/P1Fast.Cockpit.Domain/`). É necessário, porque o .exe e o iPhone rodam
  OFFLINE na pista. Não há central a criar — o modelo é local-first e está correto.
- NÃO há um juiz único que rode a MESMA gravação nas 3 e quebre quando divergem. Existe paridade
  por PARES (JS↔C# via fixture do PDF Injepro; JS↔Swift via 129 asserts espelhados em
  `ios/p1fast-core/Sources/P1FastSmoke/main.swift`), e uma fixture tri-plataforma declarada
  (`web/cockpit/fixtures/stint-brasilia-3-laps.v1.json`) que HOJE nenhum teste carrega.
- NÃO há número de versão que amarre as 3 a uma mesma regra.

## DIVERGÊNCIA REAL JÁ EXISTENTE (não hipótese)

- LUZ DE MARCHA POR TORQUE existe só no JS (`web/cockpit/live-data-bridge.js:59-77`,
  `peakTorqueRpm`). O C# do .exe só tem o modo por redline (`LiveDataBridge.cs:117 RpmToShift`;
  `LiveLimits` sem `PeakTorqueRpm`; grep "torque" em `windows/cockpit/Domain/` = vazio).
  CONSEQUÊNCIA: o .exe construído hoje acende a luz por rotação (redline) — regressão direta da
  regra dura do Flávio (shift light por TORQUE NA RODA POR MARCHA, 26/05). CONSERTAR antes de
  qualquer demo do .exe.
- Análise de trecho/delta/classificador/pedagogia só existe no JS; o C# ainda não tem.
- Detector vive em 3 cópias (JS legado, Swift fonte-da-verdade por ADR-025, Deno edge) — a própria
  ADR-025 chama de "dívida arquitetural real".

## Princípios da política

1. LOCAL-FIRST é a regra. A nuvem só espelha e arquiva. Abandona-se de vez a ideia de "análise só
   na nuvem" — ela nunca existiu no caminho ao vivo.
2. PARIDADE, não centralização. A lógica existe 3x; o objetivo é PROVAR que as 3 dão o mesmo
   resultado, não ter uma cópia só.
3. CADA TIPO TEM UMA FONTE ÚNICA. 4 mundos: regras de cálculo, mensagens ao piloto, formato de
   dado, visual. Cada um com seu dono. Ninguém inventa, todos copiam.
4. A FIXTURE É O JUIZ. "Está igual?" se prova rodando a MESMA gravação real nas 3 e comparando a
   saída — não por leitura de código nem fé.
5. NADA VAI A CAMPO FORA DE VERSÃO. Cada plataforma declara a versão de contrato; atrasada aparece
   no mapa ANTES da pista.
6. A REGRA APROVADA PELO FLÁVIO MANDA. Mensagens, tipos de curva, dyno, barras: canone em
   `_design-reference/`. Código lê o canone, não redigita.
7. LEVE. Equipe pequena: +1 tabela de versões, +1 teste de paridade por módulo, +1 checagem antes
   da pista. Sem aprovação em camadas.

## Fonte única por tipo

1. REGRAS DE CÁLCULO — spec executável. Detector já tem dono (Swift, ADR-025). Demais (shift-light,
   alertas, delta, parser): JS de `src/` como referência até o porte nativo provar paridade.
2. MENSAGENS AO PILOTO — os JSON aprovados em `_design-reference/versions/mensagens-*.json`. Hoje o
   código REDIGITA (`web/cockpit/mensagens-pedagogicas.js:21`); a política faz as 3 carregarem/
   embarcarem o MESMO JSON e um teste comparar texto-no-código == texto-no-JSON.
3. FORMATO DOS DADOS — `docs/hardware/T4000_CAN_SPEC.md` + fixture do PDF (checksum 0x91). Hoje
   duplicada byte a byte em JS e C#; trocar por um JSON único lido pelos dois.
4. VISUAL/MOCKUP — mockups em `_design-reference/*.html`, congelados (ADR-023:146). Já é contrato.

## Como provar consistência (o juiz)

1. Cada fixture `.v1.json` ganha um irmão `.v1.expected.json` (gabarito), gerado pela plataforma-
   dona daquele módulo.
2. Cada plataforma ganha 1 teste de paridade: lê a fixture, roda sua implementação, compara com o
   gabarito. JS já tem o harness de smokes; C# tem xUnit; Swift tem P1FastSmoke. Falta só ligar a
   fixture compartilhada nos 3.
3. Começar pela luz de marcha (a regressão real): gerar o gabarito → o teste C# falha hoje →
   prova o valor no primeiro dia → fica verde quando o torque for portado pro C#.
4. Command Box (web) já importa o cérebro único de produção (`web/command-box/marcha-real.js`,
   `frenagem-real.js`) — estender esse padrão ao app na nuvem aberto no navegador via Fire TV
   Stick 4K Max na TV 32" (atualizado 16/06/2026 — ver docs/ARQUITETURA_DEFINITIVA.md).

REGRA DE OURO: paridade verde é pré-requisito de build. Sem verde, não empacota .exe nem gera
build de pista.

## Versão de contrato

- Um arquivo único de versão (ex: `contract.json`) com 4 números: regras, mensagens, dados, visual
  (mudam em ritmos diferentes). Ancorado no que já existe (fixtures já usam `schemaVersion` SemVer;
  mensagens já são v1/v2 datadas).
- Cada plataforma declara qual contrato roda (campo no Domain C#; constante no `Release.xcconfig`
  iOS; versão do deploy web).
- Antes da pista: a checagem confere que as 3 declaram a mesma versão (ou diferença autorizada).

## Processo de propagação (5 passos, leve)

1. Muda na fonte-dona primeiro (regra na dona; mensagem no JSON aprovado; dado na spec; visual no
   mockup). Mensagem/tipo-de-curva passam pela aprovação do Flávio (em HTML) antes.
2. Regenera o gabarito; sobe a versão daquele tipo (+1).
3. Aplica a mesma mudança nas outras duas linguagens.
4. Roda o teste de paridade nas 3; verde = alinhado.
5. As 3 declaram a nova versão; só então pode build/TestFlight/deploy.
Custo típico: editar 3 arquivos + 1 gabarito + rodar 3 testes. Minutos.

## Offline (tensão resolvida)

Não há conflito: a "central" nunca foi o cérebro ao vivo. O .exe carrega regra+mensagens+gabarito
EMBARCADOS no binário no build; na pista não precisa de rede. A "central" da política é o CONTRATO
(fixture + gabarito + versão), não um servidor. A nuvem segue só espelhando o dado cru
(`cockpit-bubi-live`) e fazendo a análise pós-stint (`api/advisor.js`), que nunca toca a pista.

## Rastreabilidade (mapa visual)

Um mapa (navegador, largura total, sem emoji, padrão P1 Fast): linhas = tipos x módulos
(shift-light, detector, delta, alertas, parser, mensagens); colunas = as 3 plataformas; célula =
versão declarada + status (verde alinhado / amarelo atrasado-fora-de-campo / vermelho divergente-
em-campo). Lê as versões declaradas e o resultado dos testes de paridade — não é digitado à mão.
Vira uma aba do mapa de status que já existe (`relatorios/STATUS-EXE-COCKPIT-WINDOWS.html`).
HOJE mostraria: shift-light × .exe Windows = VERMELHO (roda por redline, contrato pede torque).

## Decisões do Flávio (com recomendação)

1. Luz de marcha errada no .exe é prioridade? → SIM, antes de qualquer demo do .exe. (recomendo)
2. Dono por módulo de regra? → JS de `src/` como referência até o porte nativo provar paridade;
   nativo vira dono só com paridade verde. (recomendo)
3. Mensagens e tipos de curva continuam só do Flávio (aprovação em HTML)? → SIM, como já é.
4. Quando criar a tabela de tipos de curva no banco (hoje hardcoded)? → só ao migrar pra produção,
   com "MIGRAR PARA PRODUÇÃO" explícito. (recomendo esperar)
5. Pagar Apple Developer/TestFlight (US$ 99/ano)? → decidir quando o app for pra mão de mais alguém
   além do device do Flávio. (recomendo esperar)
