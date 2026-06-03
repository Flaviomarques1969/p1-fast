# Tarefa atual — TASK_INIT (2026-06-01) — Leitura de etiqueta da peça com IA + preço Mercado Livre

## 1. Pedido (Flávio, 2026-06-01)
Ao fotografar a etiqueta, a IA deve LER o descritivo (qualquer formato/marca, sem padrão fixo) e
preencher nome/especificação/código; e buscar o preço da peça no Mercado Livre. Decisões do Flávio
(card): leitura = IA na nuvem; preço = aceitou raspagem (melhor-esforço).

## 2. Objetivo
Foto da etiqueta → IA estrutura os dados e preenche o cadastro; preço de referência (ML) quando possível.

## 3. Fatos verificados (não inferidos)
- API oficial de busca do Mercado Livre = FECHADA (403 mesmo com token; relatos públicos). WebFetch na busca do ML = 403 também. Raspagem caseira não passa; precisa serviço de raspagem PAGO (Bright Data — não configurado aqui).
- App conecta num Supabase ÚNICO (project "p1-fast"), no ar (produção). Edge Functions em Deno/TS (padrão std http serve + esm.sh). Nenhuma usa IA hoje. Supabase CLI 2.101.0 disponível (testa função local).
- Eu (IA de visão) já li a etiqueta Sabó da foto: Nº 02370, "Ret da saída da transmissão", aplicação Corsa/Astra, dim. 35x54x10/15 mm, nitrílico, EAN 7891252023700.

## 4. Plano REVISADO (2026-06-01, pós-prova do navegador) — TUDO no app, grátis, sem servidor/chave
Prova: abri o ML num navegador real (Chrome) e li o preço sem bloqueio. Peça da foto (retentor saída
transmissão Corsa Sabó 02370) = ~R$ 39,90/un, kit R$ 78,90. Flávio confirmou "sim". Logo:
1. OCR LOCAL (Vision/VNRecognizeTextRequest) lê o texto da etiqueta (qualquer formato) → preenche nome + especificação (+ EAN se achar). Grátis, offline. → `EtiquetaOCR.swift`.
2. Preço ML via WKWebView embutida: abre a busca do ML (navegador real = sem 403), lê o 1º preço ativo (mediana), preenche o campo Preço. Grátis. → `BuscaPrecoMLView.swift`.
3. Botões no PecaNovoFormView: "Ler etiqueta (foto)" + "Buscar preço no Mercado Livre".
4. xcodegen generate (incluir arquivos novos) + compilar (simulador + device) + instalar no iPhone.
5. (FUTURO/opcional) "IA de verdade" pra estruturar campos melhor — só se o OCR local não bastar (aí precisaria chave/servidor).
NÃO precisa mais: chave de IA, Edge Function, serviço de raspagem pago, tocar produção.

## 5-11. Ambiente DESENVOLVIMENTO (determined-beaver-390de9). Produção NÃO é tocada (tudo roda no app). Flávio confirmou "sim" (2026-06-01).
Riscos: OCR depende da qualidade da foto; WKWebView do ML pode mudar layout/pedir consentimento (melhor-esforço); validar no device.

## 12. Status: CONCLUÍDO no app — instalado no iPhone, aguardando validação do Flávio.

### TASK_DONE (2026-06-01)
- Pedido conferido: sim (ler etiqueta por foto + preço ML, ambos no app, grátis).
- Ambiente: desenvolvimento (determined-beaver-390de9). Produção NÃO tocada.
- Alterações: 2 arquivos novos (EtiquetaOCR.swift = OCR Vision; BuscaPrecoMLView.swift = WKWebView + lê preço) + PecaNovoFormView (botões "Ler etiqueta" e "Buscar preço no ML" + fluxos) + mock dev --p1-preco-ml.
- Validação: build simulador + device = SUCCEEDED. Simulador provou o PREÇO ML de ponta a ponta: app leu R$ 39,90 da peça "sabo 02370" pelo navegador embutido (screenshot /tmp/p1-preco-ml.png). Botão "Ler etiqueta" visível no cadastro (/tmp/p1-peca-cadastro-novo.png). App instalado no iPhone.
- Pendência: OCR da etiqueta só testa no device (câmera) — Flávio valida; decidir incorporar à versão oficial.
- Resultado: concluído no ambiente isolado.

---
---

# (CONCLUÍDO) TASK_INIT (2026-06-01) — Editar / Apagar / 5 fotos da peça

## 1. Pedido original (Flávio, 2026-06-01, depois de testar no iPhone)
(a) Botão Apagar peça precisa pedir CONFIRMAÇÃO antes. (b) Apagar deve ficar SÓ dentro de uma
tela de edição de dados, acionada por um botão novo "Editar". (c) Na tela de usar (adicionar/
retirar +1/−1) NÃO tem botão apagar. (d) Botão "Editar" novo pra editar os dados da peça.
(e) Fotos: até 5 (era 3). (f) Confirmado: ao escanear o código não vem o nome → fica manual.

## 2. Objetivo
Mover o Apagar pra uma tela de edição (com confirmação), tirar da tela de usar; criar botão
Editar; subir o limite de fotos de 3 pra 5.

## 3. Critérios de conclusão
- [ ] Tela de usar (detalhe +1/−1) sem botão Apagar.
- [ ] Botão Editar abre tela de edição dos dados da peça.
- [ ] Apagar só na tela de edição, com confirmação antes.
- [ ] Peça aceita até 5 fotos.
- [ ] Compila + testes do core verdes + instalado no iPhone + validado pelo Flávio.

## 4. Plano (≤5 passos)
1. PecaRepository: maxFotos 3→5.
2. PecaNovoFormView: aceitar peça pra editar (pré-preenche; título "Editar peça"; esconde
   quantidade inicial; mostra Local; botão Apagar com confirmação; salvar via atualizarPeca).
3. PecaDetalheView: remover botão Apagar + alert; adicionar botão Editar (toolbar) + sheet de edição.
4. Build simulador + testes do core.
5. Instalar no iPhone + pedir validação.

## 5. Ambiente: DESENVOLVIMENTO (determined-beaver-390de9). Produção protegida. Sem autorização produção (não necessária).
## 6. Arquivos a editar: PecaViews.swift, PecaRepository.swift (PecaModels.swift lido — campos `var`, dá pra editar preservando created_at).
## 7-11. Riscos: não quebrar o cadastro novo (já aprovado) ao reusar o form; sheet sobre sheet no detalhe; validar no device.
## 12. Status: CONCLUÍDO no ambiente isolado — aguardando validação do Flávio no iPhone.

### TASK_DONE (2026-06-01)
- Pedido original conferido: sim (confirmação ao apagar; Apagar só na edição; sem Apagar no usar; botão Editar; 5 fotos; código de barras manual).
- Ambiente trabalhado: desenvolvimento (determined-beaver-390de9).
- Produção foi alterada: não.
- Arquivos reais inspecionados: sim (PecaViews, PecaRepository, PecaModels, HubMockLauncher).
- Alterações feitas: sim.
- Testes/validação executados: compila no simulador E no iPhone (BUILD SUCCEEDED nos dois); screenshots do simulador (detalhe sem Apagar + com Editar; topo da edição com título "Editar peça", campos preenchidos e "Até 5 fotos"); app instalado no iPhone. Não há suíte automatizada de UI pra peça; o núcleo P1FastCore não foi tocado.
- Resultado: concluído no ambiente isolado; validação final do Flávio no device pendente. O rodapé da edição (botão Apagar + confirmação) não foi capturado por screenshot (scroll do simulador não controlável neste setup multi-monitor) — garantido por código e compilação.
- Pendências reais: Flávio validar no iPhone (Apagar com confirmação, editar+salvar, 5 fotos reais via câmera); decidir incorporar à versão oficial.

### Arquivos alterados
- ios/p1fast-ios/Sources/Persistence/PecaRepository.swift — maxFotos 3→5 + comentários.
- ios/p1fast-ios/Sources/Views/PecaViews.swift — form passa a editar peça existente; Apagar movido do detalhe pro form (com confirmação); botão Editar no detalhe; quantidade escondida na edição; texto "Até 5 fotos".
- ios/p1fast-ios/Sources/Views/HubMockLauncher.swift — atalhos só-dev `--p1-peca-detalhe` e `--p1-peca-editar` (inofensivos, só com launch arg).

### O que foi preservado
- Cadastro NOVO de peça (fluxo já aprovado) intacto — parâmetros novos do form têm valor padrão; nenhuma chamada existente quebrou.
- Campos/coluna do banco preservados; created_at e quantidade preservados na edição.
- Texto de confirmação de apagar reaproveitado.

---
---

# (PRESERVADO) Tarefa — TASK_INIT (2026-05-31, noite) — Navegação (menu fixo) + cadastros

## 1. Pedido original (Flávio, 2026-05-31)
(a) Menu inferior (Home·Eventos·Cadastros·Garagem) SEMPRE embaixo, em QUALQUER tela —
inclusive hub/cadastro/manutenção/estoque/detalhe de evento, que hoje abrem como "folha"
modal e cobrem o menu. (b) Cadastro do carro: remover a Cor (identidade = foto; sem foto =
ícone neutro). (c) Cadastro de peça: scanner de código de barras (lê a caixa → traz dados),
até 3 fotos, e campo "especificação de uso no carro" (calibragem, litros) p/ peças com qtd.

## 2. Objetivo
Menu fixo embaixo em todas as telas de "lugar" + cadastro do carro sem cor + cadastro de peça
com scanner/3 fotos/especificação.

## 3. Critérios de conclusão
- [ ] Menu fixo embaixo no fluxo do carro (hub, cadastro, manutenção, estoque) — validado simulador.
- [ ] Menu fixo no detalhe de evento.
- [ ] Cadastro do carro sem Cor; sem foto = ícone neutro.
- [ ] Cadastro de peça: scanner + até 3 fotos + especificação de uso.
- [ ] Validado no iPhone do Flávio.

## 4. Plano (do agente Plan, abordagem (a): shell com BottomNav FIXO fora do NavigationStack)
Fato-chave: telas de detalhe já usam `onClose: () -> Void` (não @Environment dismiss) → sheet→push
é mecânico (`onClose: { path.removeLast() }`), sem mexer no corpo delas.
- P1: HomeView — BottomNav fixo fora do stack + enum de rota expandido + destinos.
- P2: remover BottomNav duplicado de Garagem/Eventos/Pessoas (passa a ter 1 só, fixo).
- P3: migrar Garagem→Hub→Cadastro/Manutenção/Estoque de .sheet p/ push (remover NavigationStack
  internos; esconder nav bar nativa no Hub por causa da foto edge-to-edge).
- P4: EventoDetalhe vira push (wizard de stint continua sheet).
- P5: limpeza (remover onNavSelect/navSelection mortos).
Corte: "lugares" (hub, cadastro, manutenção, estoque, evento detalhe, setup, trechos) = push c/ menu.
"Seletores/confirmações" (pickers pneu/combustível, forms rápidos, wizard stint, sincronização) = continuam folha.
Risco: stacks aninhados, back duplo, perda de estado ao trocar aba, environmentObjects, mocks de screenshot.
ESCOPO DESTA SESSÃO: P1+P2+P3 (fluxo do carro) validado no simulador. Depois cor (b) e peça (c).

## 5. Ambiente: DESENVOLVIMENTO (determined-beaver-390de9). Produção protegida. Sem autorização produção (não necessária).
## 6. Status (2026-05-31, noite — em andamento)
**UPDATE +1h:** P4 navegação de EVENTOS FEITA (EventoDetalheView vira push via HomeNavTarget.eventoDetalhe;
EventoCard virou NavigationLink; nav bar nativa escondida pq tem topbar "‹ Eventos"; wizard de stint
continua sheet). Pedido (c) PEÇA: campo de especificação ajustado p/ "Especificação e uso no carro" +
exemplos (calibragem/litros); SCANNER de código de barras FEITO — `BarcodeScannerView.swift` (VisionKit
DataScanner, @MainActor no `disponivel`), botão no campo Código do PecaNovoFormView, +NSCameraUsageDescription
no project.yml. Modelo Peca JÁ tinha `codigo` e `especificacao` (sem migration). Tudo compila + instalado no iPhone.
**+2h: 3 FOTOS FEITAS** — PecaRepository.salvarFotos/carregarFotos (até 3 locais; índice 0={id}.jpg
principal no fotoUrl, 1/2={id}-N.jpg), CameraPicker.swift (UIImagePickerController câmera),
PecaNovoFormView com 3 slots (câmera OU galeria via confirmationDialog + .photosPicker(isPresented)
+ .fullScreenCover), criarPeca(fotos:[UIImage]), faixa de fotos no PecaDetalheView. Validado UI no
simulador (--p1-hub-mock --p1-peca). TODOS OS 3 PEDIDOS (navegação + cor + peça) FEITOS, compilando e
instalados no iPhone. AGUARDANDO validação final do Flávio (câmera/scanner/3 fotos só testam no device real).
**PESQUISA BASE CÓD. BARRAS (01/06):** testei DotCompany (endpoint /api/catalogo/public/buscar mas sem API aberta
a terceiros — devolve landing), produto.xyz (morta), Open Products Facts (sem autopeça BR), Cosmos (10/mês).
Nenhuma grátis serve bem → RECOMENDEI cadastro MANUAL pras ~50 peças (cadastro 1x; depois só movimentação).
Flávio pediu /clear sem bater martelo manual vs Mercado Livre — confirmar ao retomar (provável manual = nada a fazer).
**PRÉ-CLEAR 01/06:** checkpoint completo em ~/.claude/projects/-Users-imac-Projetos-P1-Fast/memory/p1-fast-checkpoint-navegacao-menu-fixo-2026-05-31.md.
PRÓXIMOS: (1) Flávio validar no iPhone; (2) decidir base; (3) incorporar à versão oficial.
(histórico abaixo)
FEITO + validado no SIMULADOR (não no device ainda — iPhone desconectou/unavailable):
- P1+P2+P3 navegação: BottomNav FIXO fora do NavigationStack (HomeView). Garagem/Eventos/Pessoas
  sem BottomNav próprio. Fluxo do carro (hub/cadastro/manutenção/estoque) virou push
  (navigationDestination em HomeNavTarget) com `onClose: { navPath.removeLast() }`. Hub esconde
  nav bar nativa (.toolbar(.hidden)) por causa do "X" + foto edge-to-edge. CarroCard e botões do
  hub viraram NavigationLink(value:). Validado: hub (menu, só X), estoque (menu+toolbar), cadastro
  (menu+FootBar). Mock: HubMockLauncher monta HomeView REAL com initialRoute (--p1-hub-mock,
  +--p1-deep abre cadastro). HomeView ganhou `var initialRoute: [HomeNavTarget]` (só-dev).
- Pedido (b) COR: removida do CarroModalView + CarroNovoFormView (CorPicker). Garagem sem foto =
  ícone neutro car.fill (não bolinha colorida). Cor preservada no banco (não removi coluna).
  `corHex` em CarroNovoFormView ficou órfão (warning, não erro). CorPicker struct preservado.
APROVADO PELO FLÁVIO no iPhone 31/05 noite ("tudo funcionando"): menu fixo no fluxo do carro +
navegação pelas abas + cadastro sem cor. (Não capturei screenshot do device — túnel não subiu; Flávio validou.)
FALTA: P4 navegação de EVENTOS
(EventoDetalheView vira push — wizard de stint continua sheet); pedido (c) peça: scanner código de
barras + até 3 fotos + campo "especificação de uso". Builds: device /tmp/p1fast-dd, sim /tmp/p1fast-dd-sim.

---
---

# (PRESERVADO) Tarefa — Foto do carro + foto de fundo no hub (2026-05-31, noite)

## 1. Pedido original (Flávio, 2026-05-31, retomada "voltei hub")
"Você perdeu a foto que tinha do carro porque é onde está o bolinho ali, está com um botão
amarelo ali era a foto, colocar a foto para o carro e sobre essa ideia de colocar a foto na
tela maior é para ela ficar no fundo, o texto pode continuar onde está."

## 2. Objetivo (1 frase)
Colocar a foto do carro (Bolinha) de volta e, no hub do carro, fazer a foto virar o FUNDO da
tela (não mais só uma faixa no topo), mantendo o texto na posição atual.

## 3. Critérios objetivos de conclusão
- [ ] Receber/definir a foto do carro (insumo do Flávio — não há foto recuperável).
- [ ] Foto aplicada ao carro e visível no hub.
- [ ] Hub: foto como fundo da tela, texto na posição atual, com legibilidade preservada.
- [ ] Decidir com o Flávio: foto também na Garagem (lista) no lugar da bolinha colorida?
- [ ] Build + instalar no iPhone + validação visual do Flávio.

## 4. Leitura dos arquivos obrigatórios: feitos (CLAUDE.md, protocolos, padrões).

## 5. Plano (≤5 passos)
1. (FEITO) Diagnosticar onde a foto foi parar — verificado: não há foto guardada.
2. Receber a foto do Flávio (arquivo) OU ele escolhe no Cadastro (PhotosPicker já existe).
3. Reescrever heroHeader do CarroHubView → foto de fundo full-bleed + legibilidade.
4. (se decidido) Mostrar foto no card da Garagem no lugar do swatch.
5. Build + instalar no iPhone + validar.

## 6. Diagnóstico verificado (evidência, não inferência)
- Foto do carro hoje = LOCAL no iPhone: `Documents/carros-fotos/{carroId}.jpg` (CarroFoto.swift).
- Puxei a pasta do iPhone via devicectl → **VAZIA**: não há foto local salva.
- Garagem (CarroCard) mostra um CÍRCULO da cor do carro (swatch), nunca foto — é o "amarelo".
- Foto-na-nuvem (`foto_url` + bucket `carro-fotos`) existe só ARQUIVADA em
  `_archive/propostas-2026-05-13/` — nunca entrou no app. Logo, nada a recuperar da nuvem.
- Cadastro (CarroModalView) JÁ tem campo "Foto do carro" → "Escolher foto" (PhotosPicker) → salva local.

## 7. Ambiente alvo: DESENVOLVIMENTO (worktree determined-beaver-390de9).
## 8. Produção protegida: sim.
## 9. Autorização para produção: não (não necessária — desenvolvimento).
## 10. Evidência: não aplicável.
## 11. Riscos: sem a foto do Flávio, não há o que "recuperar"; foto de fundo full-screen exige
overlay pra legibilidade dos botões; não confirmar visual no iPhone = não declarar pronto.
## 12. Status: AGUARDANDO insumo (foto) + decisão de escopo (Garagem sim/não).

---
---

# (PRESERVADO) Tarefa anterior — Planejamento de consumíveis Celta (2026-05-31, tarde)

# Última tarefa — TASK_INIT (2026-05-31)

## 1. Pedido original (Flávio, 2026-05-31)
"Em P1 Fast você estava com um trabalho de fazer um planejamento para a gente gerenciar os
consumíveis do CELTA de corrida 1.4: definir quais são os consumíveis, qual o método para
gerenciar os intervalos de cada consumível e qual o intervalo proposto para cada um;
permitir que eu altere esses dados e que eu possa te orientar em cada um deles, para a gente
montar um prompt de planejamento para implementar na função Garagem do P1 Fast. E gera um
HTML para mim no navegador."

## 2. Objetivo (1 frase)
Entregar um HTML interativo no navegador que liste os consumíveis do Celta 1.4 de corrida com
método + intervalo proposto, editável pelo Flávio e com campo de orientação por item, que gere
ao final um prompt de planejamento para implementar na função Garagem → Manutenção.

## 3. Critérios objetivos de conclusão
- [x] HTML criado e aberto no Chrome do Flávio.
- [x] Lista de consumíveis do Celta de corrida (partindo do catálogo real de 15 itens já existente).
- [x] Cada item com método de intervalo + intervalo proposto + justificativa.
- [x] Campos editáveis (método, intervalo) + campo "sua orientação" por item.
- [x] Adicionar/remover itens.
- [x] Botão que gera o prompt de planejamento consolidado, incorporando as edições e orientações.
- [x] Persistência local (não perder o que ele digitou).

## 4. Leitura dos arquivos obrigatórios
- ~/.claude/CLAUDE.md — lido (contexto da sessão)
- ~/.claude-decisoes/padroes.md — lido (sem decisões registradas ainda)
- ~/.claude/FLAVIO_EXECUTION_PROTOCOL.md — lido
- ~/.claude/FLAVIO_DONE_CHECKLIST.md — lido
- ~/.claude/FLAVIO_ENVIRONMENT_RULES.md — lido
- ~/.claude/FLAVIO_COMMUNICATION_RULES.md — lido

## 5. Plano (≤5 passos)
1. Verificar o que já existe de manutenção/consumíveis (FEITO — está órfão no worktree infallible-snyder-198a08, fora da versão oficial).
2. Ler catálogo real (15 itens) + plano de manutenção (FEITO).
3. Criar HTML interativo de planejamento de consumíveis de corrida.
4. Abrir no Chrome do Flávio.
5. Esperar ele editar/orientar → montar o prompt de implementação final.

## 6. Arquivos/áreas inspecionados
- `infallible-snyder-198a08/ios/p1fast-core/Sources/P1FastCore/Manutencao.swift` — catálogo 15 itens + motor de cálculo.
- `infallible-snyder-198a08/docs/PLANO_MANUTENCAO.md` — plano genérico de manutenção (rua).
- versão oficial (worktree atual): grep confirma que NÃO há código de manutenção em main (só Garagem).
- STATUS.md, memórias de manutenção e dyno do Celta.

## 7. Ambiente alvo: DESENVOLVIMENTO
## 8. Produção protegida: sim
## 9. Autorização para produção: não (não necessária — só cria HTML de planejamento)
## 10. Evidência da autorização para produção: não recebida (não aplicável)

## 11. Riscos
- Os intervalos propostos são chutes iniciais de preparação típica — quem valida é o Flávio (por isso editável).
- Função Manutenção está órfã num worktree: precisa decidir se reaproveita o código de 18/05 ou refaz na implementação.
- Método "por evento/bateria" não existe no motor de cálculo atual (suporta horas/km-pista/data/desgaste) — é extensão a implementar.

## 12. Status: PAUSADO PARA /clear (2026-05-31 ~13h) — retomar do checkpoint.

### Evolução até o /clear
- Instrumento HTML reconstruído 4 vezes conforme o Flávio aprofundou: v1 (20 itens rua) → v2 (30 itens corrida, régua evento) → v3 (indicador mínimo escolhível) → **v4 (modelo CHECAGEM + TROCA, 30 itens)**.
- Modelo final fechado: cada item tem CHECAGEM (inspeção recorrente) ≠ TROCA (4 modos: pelo resultado / limite máximo / preditivo-IA / só recomendação). Cadência 1 evento/mês.
- Orientações do Flávio capturadas e embutidas no HTML (óleo 2h, pneu preditivo por horas, filtros laváveis, rolamento 8h, amortecedor 6h, coxins 3 eventos, mangueira/flexível 24 meses, etc.).
- Ponto de retomada completo (caminhos, como religar servidor, modelo, próximos passos) em:
  `~/.claude/projects/-Users-imac-Projetos-P1-Fast/memory/p1-fast-checkpoint-consumiveis-celta-2026-05-31.md`
- Backup durável do instrumento: `~/.claude/projects/-Users-imac-Projetos-P1-Fast/memory/p1-fast-INSTRUMENTO-consumiveis-celta.html`

### Pendências reais
- Flávio revisar os 30 itens e mandar "gera o prompt".
- Confirmar torque do reaperto de roda (~95 N·m).
- Decidir: trazer função Manutenção órfã (infallible-snyder-198a08) pra versão oficial ou refazer.
- Nada foi pra produção. Tudo em desenvolvimento.

---
---

# (PRESERVADO) Tarefa anterior — Pacote noturno auditoria 26/05/2026

## TASK_DONE — 2026-05-27 (madrugada, ~02:30 horário de Brasília)

- **Pedido original:** Pacote noturno da auditoria de 26/05/2026. Tarefa autônoma do agente noturno.
- **Objetivo resumido:** Ler o quadro, fazer limpezas seguras, sinalizar arquivos obsoletos, criar relatório com decisões pendentes, submeter pra aprovação formal.

### O que foi feito

1. **Leitura do quadro:**
   - Lido `docs/AUDITORIA_REAL_2026-05-26.md` (retrato honesto do estado real)
   - Lido `STATUS.md` (checkpoint 2026-05-26 com sessão noturna)
   - Buscado estado atualizado do main via `git fetch origin main`
   - Identificado 8 submissões abertas reais: #218, #203, #202, #193, #166, #97, #94, #51

2. **Limpezas seguras:**
   - `git remote prune origin` executado — nada a podar
   - Verificado: nenhuma submissão anômala (mergeada mas aberta)
   - #201 e #205 já foram encerradas por sessão anterior (madrugada 27/05)
   - `git branch -r --merged origin/main`: vazio — repositório remoto tem só `origin/main`

3. **Sinalizações de obsolescência:**
   - `docs/HANDOFF_2026-05-03_NOITE.md` — marcador TODO adicionado
   - `docs/SESSION_HANDOFF_2026-05-09_pre-clear.md` — marcador TODO adicionado
   - `docs/SESSION_HANDOFF_2026-05-13_pre-clear.md` — marcador TODO adicionado

4. **Relatório criado:**
   - `docs/_relatorios/RELATORIO_NOTURNO_2026-05-26.md`
   - 10 cartas de decisão pendente para Flávio
   - Alerta sobre 13 commits "auto-save" diretos no main (desvio ADR-021)

5. **Submissão criada:**
   - Linha de trabalho: `relatorio-noturno-2026-05-26`
   - Submissão: #219 — https://github.com/Flaviomarques1969/p1-fast/pull/219
   - NÃO incorporar automaticamente — Flávio revisa de manhã

### Descobertas importantes registradas no relatório

- Submissões #201 e #205 já encerradas (sessão autônoma de 01:18 do dia 27/05)
- 13 commits "auto-save" diretos no main durante sessão de 26/05 (desvio ADR-021)
- Submissão #218 aberta com curadoria de #201+#205 — aguarda decisão
- 8 submissões abertas envelhecendo — 7 delas com recomendação de incorporar

### Próximo passo para Flávio

Ler `docs/_relatorios/RELATORIO_NOTURNO_2026-05-26.md` e para cada carta:
- Dizer "incorporar #NNN" para as que recomenda incorporar
- Decidir sobre os alertas de fluxo de trabalho (auto-saves no main)
- Verificar o canal de envio iPhone→nuvem no painel Supabase
