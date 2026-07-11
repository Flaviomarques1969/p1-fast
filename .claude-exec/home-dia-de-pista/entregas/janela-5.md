# JANELA 5 — ESTRUTURA DA HOME "Dia de Pista" — ENTREGA

**Papel:** J5 (trava `travas/janela-5`). Ambiente isolado: worktree
`.claude/worktrees/home-j5-estrutura`, linha `claude/home-j5-estrutura`, a
partir da versão oficial LOCAL (`main` @ 68813c12). NUNCA incorporada.
HEAD do branch ao entregar: `d7e47e96` (auto-save capturou parte do trabalho no
próprio branch — isolado, sem merge).

## O que foi feito
Reescrevi o ESTADO CHEIO da `HomeView.swift` contra o CONTRATO da COORDENACAO.md
e criei as peças provisórias, ligando dado real e removendo os botões de teste
da Home. As 5 assinaturas do CONTRATO foram conferidas 1:1 contra os componentes
reais das J1–J3 nas worktrees delas ANTES de programar — encaixe direto na troca.

### Hierarquia do estado cheio (de cima pra baixo) — entregue
1. **Cabeçalho** "P1 Fast" (P1 branco + Fast azul) + acesso à conta discreto (avatar).
2. **`HeroEventoCard`** com dado real: evento de hoje / próximo evento; anel de
   prontidão % (pendências resolvidas/total, **nil sem dado** → anel some);
   linha de pendências abertas (âmbar); botão "Iniciar Stint" (onStint atual);
   selo "HOJE" azul quando `diasAte==0`, "EM N DIAS" âmbar quando futuro.
   Sem evento futuro → herói honesto "Sem eventos planejados" + "Criar evento".
3. **`AoVivoRow`** → AssistirView (tela de espectador).
4. **`MelhorVoltaCard`** (tempo real; "—" honesto sem volta) → MelhorVoltaView.
5. **`CarroRowCompacta`** (até 3 carros reais) → CarroHubView; link "Garagem" no título.
6. **`NumerosRodape`** → Eventos / Voltas / Stints (clicáveis).

### Removido da Home (telas preservadas)
- Botões antigos "ASSISTIR AO VIVO" / "TESTE AO VIVO" e caixa "ATALHOS DEV".
- Os structs `AssistirButton`, `TesteAoVivoButton`, `DevShortcuts` foram
  PRESERVADOS no arquivo, sem chamada. Rotas `.testeAoVivo`/`.telemetriaDemo`
  intactas (a porta pras ferramentas de teste passa a ser a Garagem — área da J4).

### Preservado (nada apagado)
- Estado vazio (`EmptyContent`) intacto; NavRouter/HomeNavTarget/BottomNav fixo;
  telas dos números (Voltas/Stints/MelhorVolta); PendenciasProximoEventoLauncher;
  comportamento do botão Stint (onStintTap/stintTapDecision).
- Structs antigos sem chamada: `EventoAtivoHojeCard`, `ProximoEventoCard`,
  `CarroRow`, `StintAoVivoCard`, `AoVivoDot`, uso de `SummaryStats`; helpers
  `eventoLink`, `carroLink`, `headerStatusLine`.

## Arquivos alterados (delta vs main — 4 arquivos, 574+ / 90−)
- `ios/p1fast-ios/Sources/Views/HomeView.swift` (+258 / −90) — reescrita do
  estado cheio + `HeroSemEvento` (estrutura, não é componente J1–J3) + extensão
  do `HomeData` com `prontidaoPct`/`pendenciasAbertas`.
- `ios/p1fast-ios/Sources/Views/HomeDiaDePistaStubs.swift` (+371, NOVO) — as 5
  peças provisórias. Marcado no topo: "PROVISÓRIO — o coordenador substitui pelos
  componentes reais das J1–J3 na integração e apaga este arquivo."
- `ios/p1fast-ios/Sources/Views/ContentView.swift` (+31) — seam de integração
  (dado real): ver "Notas para a integração".
- `ios/p1fast-ios/p1fast-ios.xcodeproj/project.pbxproj` (+4) — o `xcodegen
  generate` registrou o arquivo novo de stubs no projeto (consequência mecânica).

**Fora do delta:** Theme.swift, GaragemView, web/, cockpit, cérebro, Supabase,
componentes das J1–J3 — nada tocado. (HubMockLauncher recebeu 2 branches de PROVA
temporárias só pra tirar as fotos vazio/rodapé e foi **revertido** — não está no delta.)

## Prova real (executada)
Empacotamento (build) no simulador **P1-Zoom375** (id 1BC2F7A1..., 375×812), com
os provisórios:

```
xcodegen generate            → Created project (stubs registrados; grep -c = 4 no pbxproj)
xcodebuild -project p1fast-ios.xcodeproj -scheme p1fast-ios \
  -destination 'id=1BC2F7A1-222E-44A5-A117-1314F6FA2623' -configuration Debug build
  → ** BUILD SUCCEEDED **   (sem error:, sem warning de unused/never-used nos meus arquivos)
```
Build final LIMPO (código entregue, sem as branches de prova): **BUILD SUCCEEDED**.

**Testes existentes:** não há alvo XCTest no iOS (mesma constatação da J1) — nada
a rodar; nada quebrado.

**Fotos** (em `entregas/provas-j5/`, simulador P1-Zoom375, app instalado e aberto
via `--p1-hub-mock` que dispensa login). **ATENÇÃO — os números das fotos (64%,
1:42.3, 158 voltas, "EM 7 DIAS") são DADOS DE EXEMPLO de `HomeData.mockFilled`,
NÃO medições reais** — a foto prova ESTRUTURA + NAVEGAÇÃO + FORMATO honesto dos
estados, como o mandato pede. A ligação de dado REAL (prontidão somente-leitura,
melhor volta de `carroRepo`, números reais) está no código/seam do ContentView e
foi provada pelo BUILD SUCCEEDED, não pelos números do mock:
- `home-cheio.png` — estado cheio, variante "EVENTO DE HOJE": herói (anel âmbar
  64% PRONTO, "3 pendências antes da pista" âmbar, "Iniciar Stint" azul, selo HOJE
  azul) + AoVivoRow + Melhor Volta 1:42.3 + Seus Carros (Celta 1.4 · 31 stints) +
  BottomNav fixo.
- `home-rodape.png` — variante "PRÓXIMO EVENTO" (selo "EM 7 DIAS" âmbar, dias
  calculados de verdade) + `NumerosRodape` visível (12 Eventos · 158 Voltas · 47 Stints).
- `home-vazio.png` — onboarding preservado ("Comece pela garagem", 3 passos, 2 CTAs).

Padrão visual conferido nas 3 fotos: fundo escuro; sem emoji (só ícone de traço/
avatar SVG do sistema); **vermelho ausente**, atenção = âmbar, azul = ação/accent;
tratamento "você"; largura toda; ação óbvia no 1º toque ("Iniciar Stint").

## Notas para a integração (coordenador)
1. **Âmbar:** meus stubs usam `Color.atencao` (token âmbar existente 250/183/42),
   porque o token novo de âmbar da J1 não está neste branch (parti do main). Ao
   trocar pelos componentes reais, o âmbar da J1 já vem certo — nada a fazer além
   de garantir que o token novo entrou junto com o Theme da J1.
2. **`ContentView.swift` (seam de integração — 2 pontos):**
   - `realHomeState()`: calcula `prontidaoPct`/`pendenciasAbertas` do evento do
     herói via `pendenciaRepo.grupos(forEventoId:)` — **somente leitura**.
   - `bootstrap` (.task): preload **somente leitura** das pendências do evento do
     herói (`reloadInstancesForEvento` + `reloadExtras`) pra o anel nascer com
     dado real. **Nunca escreve** (não monta checklist). Sem instâncias criadas
     → prontidão nil (anel some). As instâncias são criadas quando o usuário abre
     a aba Pendências; a Home nunca escreve.
3. **`MelhorVoltaCard`:** liguei em `HomeData.melhorVoltaMs` (dado real vindo de
   `carroRepo.melhorVoltaMs`) em vez de chamar `stintRepo.resumoVoltas()`
   diretamente — dado real equivalente e sem adicionar dependência de repositório
   ao caminho sempre-renderizado da Home (o HubMockLauncher não injeta stintRepo).
   `contexto`/`evolucaoMs` = nil (honesto). Se preferir `resumoVoltas()`, é troca
   fácil no seam do ContentView. **Decisão para o Flávio confirmar.**
4. **"Ao vivo":** consolidei o card "Stint ao vivo" (Etapa 1, Flávio 25/06) DENTRO
   da `AoVivoRow` — o dado `data.stintAoVivo` alimenta `aoVivoAgora` + subtítulo.
   O struct `StintAoVivoCard` foi preservado sem chamada. **Decisão para o Flávio
   confirmar** (antes eram dois elementos "ao vivo"; agora um só, o indicador).
5. **Acesso à conta:** o avatar do cabeçalho abre a Garagem (onde Conta/Sair vive
   hoje). **Decisão para o Flávio confirmar** o destino.
6. **`HomeView` continua função pura de `HomeData`** (não acessa repositório no
   caminho sempre-renderizado) — previews e HubMockLauncher seguem funcionando.

## Pendências / limitações reais
- **iPhone 16 Pro Max:** não há esse simulador instalado nesta máquina (só
  `P1-Zoom375` e `P1-Zoom375-J4`). Provei no P1-Zoom375 (o device canônico do
  Flávio, 375×812). Não criei simulador novo (fora do escopo). — limitação declarada.
- Integração final (trocar provisórios pelos reais das J1–J3 + integrar J4 +
  rodar no simulador) é do coordenador, só com ordem do Flávio.
