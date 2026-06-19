# Ultima tarefa — P1 Fast — PASSAGEM: gráfico ocupa toda a largura do bloco — 19/06/2026

## EXECUÇÃO — Passagem com largura adaptável (19/06/2026)
- **Pedido (Flávio):** "o gráfico da passagem está muito pequeno perto do espaço que demos; ocupar todo o espaço à esquerda e à direita pra melhorar a visibilidade."
- **Causa:** bloco Passagem é 397×187 (~2,1:1, largo) mas o gráfico era desenhado em 280×195 (~1,44:1) com `xMidYMid meet` → encolhia por altura e sobrava espaço nas laterais.
- **Feito (`buildPassagemPanel`, mockup-command-box-vista-piloto.html):** largura ADAPTÁVEL — mede a área real da `.ps-canvas`, calcula W = 195×proporção e ESPALHA tudo na horizontal por fator `kx=W/280` (entrada/ápice/saída, arco, barra de distância, número grande). Círculos seguem REDONDOS (meet = escala uniforme). R 22→24. Fallback 2,6 até medir. `_reflowPassagem` força redesenho em 350ms/1200ms + no resize.
- **Validação:** sintaxe dos 3 <script> clássicos OK; escalas kx presentes; painel reaberto sem cache pela 8078. (Sem headless → confirmação visual = Flávio.)
- **Status:** concluído (DEV), aguardando validação visual.

---

# Ultima tarefa — P1 Fast — TIPO DE PNEU: 2 tipos (Radial + Semi-slick) no cadastro do app iOS — 19/06/2026

## TASK_INIT — Tipo de pneu = 2 tipos (19/06/2026)
- **Pedido (Flávio):** "nós só temos dois tipos de pneu hoje: radial (o de rua) e semi-slick. Não vamos fazer três (radial, semi-slick e slick). É o que você vai colocar lá."
- **Objetivo (1 frase):** o cadastro de pneu do app iOS passa a oferecer só 2 tipos — "Radial" e "Semi-slick" — em vez de 3 (Radial/Slick/Rua), sem quebrar pneus já cadastrados.
- **Critério de conclusão:** PneuCadastroView mostra 2 botões (Radial, Semi-slick); enum Pneu.Composto vira {radial, semiSlick} com decodificação tolerante (rua→radial, slick→semi-slick) pra não quebrar dado existente; build OK.
- **Achados (código real):** `Pneu.Composto` (Models.swift:419) = {radial, slick, rua} (String). PneuCadastroView (180-182) = 3 botões Radial/Slick/Rua. Usos: só leitura via composto.rawValue (CarroModalView:651, PneuPickerView:164, StintModalView:578,1101). Existe normalizador compartilhado normalizarTipoPneu (PlanoStint.swift:127-129) com radial-185-14/semi-slick/slick + smokes — DOMÍNIO DA FRENTE VMIN (outra sessão ativa) → NÃO mexer agora, só alinhar depois.
- **Ambiente:** DESENVOLVIMENTO (app iOS, não publicado). Produção NÃO tocada.
- **Plano:** (1) enum Composto {radial, semiSlick="semi-slick"} + init(from:) tolerante; (2) CompostoRail 2 botões; (3) build; (4) reportar + apontar VMIN/normalizador pra alinhar.
- **Riscos:** dado antigo (slick/rua) — tratado com decode tolerante (preserva, não quebra). Não atropelar a frente VMIN (não toco em web/command-box nem no normalizador/smoke).
- **Status inicial:** iniciado.

## EXECUÇÃO + TASK_DONE — 2 tipos de pneu (19/06/2026)
- EDIT `Models.swift` (Pneu.Composto): {radial, slick, rua} → {radial, semiSlick="semi-slick"} + init(from:) tolerante (rua→radial, slick→semi-slick, desconhecido→radial) + encode(to:) explícito. Preserva pneus já gravados.
- EDIT `PneuCadastroView.swift`: CompostoRail 3 botões (Radial/Slick/Rua) → 2 (Radial/Semi-slick); comentários do cabeçalho atualizados.
- NÃO toquei no normalizador compartilhado (PlanoStint.swift) nem no web/command-box (frente VMIN ativa em paralelo) — só apontei pra alinhar depois.
- VALIDAÇÃO: `xcodebuild ... -destination 'generic/platform=iOS Simulator'` => **BUILD SUCCEEDED**. (Prova clicando ao vivo pendente — automação de clique do simulador estava falhando nesta sessão.)
- Resultado: concluído no código (compila). Pendência: confirmar visual no aparelho.

---

# Ultima tarefa — P1 Fast — PLANO: reorganizar cadastro do carro (padrão x configuração) — 19/06/2026

## TASK_INIT + ENTREGA DE PLANO (19/06/2026)
- **Pedido (Flávio):** "no cadastro do carro, separar o que é PADRÃO do carro (freio, pastilha, combustível etanol/gasolina-padrão-etanol, pneus cadastrados — logo após a foto) do que é CONFIGURAÇÃO conferida a cada stint (pressão, alinhamento, suspensão). Corrigir o botão Apagar quebrando linha (Yokohama A09). Faça um planejamento e reorganize."
- **Ambiente:** DESENVOLVIMENTO. Produção NÃO tocada.
- **Mapeamento (workflow 6 agentes, prova arquivo:linha):** carro hoje só tem apelido/modelo/categoria/cor/fonte_temperatura — NÃO tem foto (foto é arquivo LOCAL, não sincroniza), NÃO tem combustível, NÃO tem freio nem pastilha. Setup (pressão/alinhamento/suspensão/bias/mapa/diferencial) vive em Configuracao.overrides (JSON livre). Tela CarroModalView = 7 seções misturadas. Combustível duplicado (catálogo por stint + texto solto). Botão Apagar do pneu (TireItem CarroModalView:620-632) sem lineLimit/fixedSize → quebra linha. Rótulo voltas vs saídas; unidade mola kg/mm vs lb/in divergentes.
- **Entrega:** mapa HTML `.claude-exec/plano-cadastro-carro-2026-06-19.html` (aberto no navegador) — 2 grupos (Padrão do carro / Configuração) + 3 decisões (1: freio/pastilha texto livre vs lista; 2: criar combustível Etanol/Gasolina padrão Etanol; 3: persistir foto que hoje some) + correções inclusas.
- **Status:** plano aprovado; 3 decisões respondidas (19/06/2026).

## DECISÕES DO FLÁVIO (19/06/2026)
1. **Freio/pastilha = item cadastrado.** Flávio cadastra o item no Estoque/Peças (com muita info detalhada); no CARRO mostrar APENAS O TIPO. "Vale para tudo" (mesma lógica do pneu: clica e seleciona). NÃO é texto livre. → design: padrão do carro referencia/seleciona item de estoque (EstoqueItem escopo=carroId, grupo Freios) e exibe só o tipo/nome.
2. **Combustível: campo Etanol/Gasolina, hoje só ETANOL** (default Etanol). Criar campo estruturado no carro.
3. **Foto: persistir de verdade** (sincroniza, não some). Hoje é arquivo local (CarroFoto). → adicionar foto_url em carros + upload/sync.

## FEITO neste ciclo (build OK)
- Botão "Apagar" do pneu (TireItem CarroModalView:606-632): +lineLimit(1)+fixedSize nos 2 botões (Editar/Apagar) + lineLimit(1) no nome → não quebra mais linha (caso Yokohama A09). BUILD SUCCEEDED.
- (antes) 2 tipos de pneu Radial/Semi-slick. BUILD SUCCEEDED.

## PRÓXIMO (reorganização grande — muda estrutura de dados salvos)
- Reorganizar CarroModalView em 2 grupos: "Padrão do carro" (identidade+foto, freio, pastilha, combustível, pneus cadastrados) e "Configuração" (pressão, alinhamento, suspensão, bias).
- NOVO no carro: campo combustível (Etanol/Gasolina, default Etanol) + coluna foto_url + referência/seleção de item de freio e pastilha (mostra só o tipo). Exige migração espelhada no Supabase (CUIDADO: regra do projeto + frente VMIN ativa).
- Sistema de itens (verificado): EstoqueItem (Models.swift:1382, escopo geral/carroId, nome/especificacao/grupo/fotoUrl/categoria obrig|desej) + catálogo ManutencaoConsumiveis (área "Freios": pastilhas, discos, fluido).

## EXECUÇÃO — etapas 1 e 2 (19/06/2026) — BUILD SUCCEEDED + app abre limpo
- ETAPA 1 (sem banco) — CarroModalView.content reorganizado em 2 grupos com `grupoHeader`: **Padrão do carro** (Identidade+foto, Pneus cadastrados) e **Configuração** (Pressão, Alinhamento, Suspensão, Freios, Motor). Subtítulo do topo trocado ("Setup base..." → "O que é fixo do carro e o que muda a cada stint").
- ETAPA 2 (com banco) — Combustível Etanol/Gasolina (padrão Etanol):
  - Models.swift Carro: +campo `combustivel: String?` (CodingKeys+init).
  - Migrations.swift: +`v33_carro_combustivel` = ALTER TABLE carros ADD COLUMN combustivel TEXT DEFAULT 'etanol' (carros antigos viram etanol).
  - CarroRepository.create: combustivel "etanol".
  - CarroModalView: @State combustivel + load(row.combustivel ?? etanol) + save(current.combustivel) + `CombustivelRail` (2 botões Etanol/Gasolina) no grupo Padrão (dentro de Identidade) + REMOVIDO o combustível texto-livre do bloco Motor (dado antigo no JSON preservado, só saiu da tela).
- VALIDAÇÃO: build simulador **BUILD SUCCEEDED**; app reinstalado abre na tela de login sem tela branca (migração v33 aplicou OK). Navegação clique-a-clique não dirigida (automação de clique do simulador instável nesta sessão) — Flávio vê na tela aberta.
- PENDÊNCIA PROD (quando for o caso): espelhar coluna `combustivel` no Supabase (carros) — NÃO feito (DEV, sem autorização prod).

## FALTAM (etapas 3 e 4 — as mais pesadas)
- ETAPA 3 — Freio e pastilha como item selecionado (mostra só o tipo). Precisa: desenhar o vínculo carro→item de estoque (qual freio/pastilha "atual"), UI de seleção no Padrão, exibir tipo. Confirmar desenho com Flávio antes (há +de uma forma).
- ETAPA 4 — Foto persistir/sincronizar. Checar se já existe mecanismo de upload de imagem (pecas/estoque_item já têm foto_url) pra reusar; depois +coluna foto_url em carros + UI.

## TASK_INIT — ETAPAS 3 e 4 (19/06/2026, retomada após /clear)
- **Contexto:** o histórico do chat foi limpo (/clear). Recuperei o contexto pelo próprio diário + código real (não inferi de memória).
- **Pedido (respostas do Flávio que fecham as 2 decisões pendentes):** "3. consumíveis. 4. b. para tudo. tudo deve ser enviado para nuvem."
  - ETAPA 3 → freio e pastilha são cadastrados em "Manutenção · consumíveis"; no carro mostra SÓ O TIPO (clica e seleciona, igual pneu).
  - ETAPA 4 → opção B: construir o envio de imagem pra nuvem AGORA e PARA TUDO (foto do carro + estoque + peças, que hoje são só locais).
- **Objetivo (1 frase):** terminar a reorganização do cadastro do carro — Etapa 3 (vínculo carro→item de consumível mostrando só o tipo) e Etapa 4 (subir todas as fotos pra nuvem) — em DESENVOLVIMENTO.
- **Critério de conclusão:** carro referencia freio/pastilha de "consumíveis" e exibe só o tipo; mecanismo de upload de imagem pra Supabase Storage construído e ligado para carro+estoque+peças, validado em DEV; build OK; nada de produção tocada sem autorização literal.
- **Leitura confirmada (19/06):** ~/.claude/CLAUDE.md; ~/.claude-decisoes/padroes.md (vazio, 0 decisões); FLAVIO_EXECUTION_PROTOCOL.md; FLAVIO_DONE_CHECKLIST.md; FLAVIO_ENVIRONMENT_RULES.md; FLAVIO_COMMUNICATION_RULES.md; P1 Fast/CLAUDE.md.
- **Ambiente alvo:** DESENVOLVIMENTO. **Produção protegida:** sim. **Produção alterada:** não. **Autorização produção:** NÃO recebida.
- **ALERTA DE AMBIENTE (FLAVIO_ENVIRONMENT_RULES):** Etapa 4 mexe em STORAGE. "Alteração em storage/bucket produtivo" é PROIBIDA sem "MIGRAR PARA PRODUÇÃO". Logo, construir/testar SÓ contra storage de DEV. Subir bucket/foto em produção exige autorização literal depois.
- **Verificação já feita (código real):** (a) NENHUMA foto vai pra nuvem hoje — CarroFoto/EstoqueRepository.salvarFoto/PecaRepository salvam imagem em arquivo LOCAL; `fotoUrl` é caminho local, não link de nuvem. (b) Existe cano de sync de DADOS (SyncQueue → Edge Functions sync/ingest/pull) que NÃO carrega imagem. (c) Última migração = v33_carro_combustivel → próxima é v34. (d) Frente VMIN ativa em paralelo mexe em web/command-box, NÃO em Migrations/iOS → sem colisão de número de migração.
- **Plano (≤5 passos):** (1) [em curso] mapear infra real com workflow de 4 leitores (carro+migrações / itens-consumíveis-pneu / foto+storage+ambiente / pipeline-sync); (2) desenhar Etapa 3 (vínculo) e Etapa 4 (upload) com base no real e confirmar com Flávio o que tiver +de um caminho; (3) implementar em DEV (migração v34+, Models/Repository/UI; subsistema de upload de imagem só DEV); (4) build simulador + smokes; (5) reportar com prova + flag de produção.
- **Riscos:** subir foto em bucket de produção sem autorização (mitigado: só DEV); colisão de migração com outra frente (mitigado: VMIN é web); novo subsistema de imagem ainda não existe (peça nova, mais pesada).
- **Status inicial:** iniciado — fase de mapeamento (workflow rodando).

## DECISÕES DO FLÁVIO (19/06, retomada) — registradas em ~/.claude-decisoes/respostas/P1 Fast/20260619-163205-...
- ETAPA 3: "Criar cadastro próprio (igual pneu)" — cadastro próprio de freio/pastilha por carro; Padrão do carro mostra o tipo.
- ETAPA 4: "Construir agora; depósito em produção depois" — upload de foto construído em DEV agora; bucket em produção só com autorização literal depois.

## MAPEAMENTO (workflow 4 leitores, prova arquivo:linha) — achados que guiaram o desenho
- Catálogo "Manutenção · consumíveis" (CatalogoConsumiveisCelta) é FIXO/hardcoded; lá não se "cadastra item pra escolher" como no pneu → por isso Flávio pediu cadastro próprio. Área "Freios" tem pastilhas/discos/fluido_freio/linhas_freio (reais, aprovados).
- Molde a espelhar = PNEU: tabela `pneus` (carro_id FK) + PneuRepository + PneuCadastroView + seção CRUD em CarroModalView.
- FOTO hoje 100% local (CarroFoto/EstoqueRepository/PecaRepository); `fotoUrl` = caminho local, NÃO sobe imagem. Cano de sync de DADOS existe (SyncQueue→Edge `sync`/`pull`) mas não carrega binário. SDK Supabase tem módulo Storage disponível, nunca usado. Só existe 1 projeto Supabase (fvhwltzhytpnhlqbttmd = PRODUÇÃO); sem projeto DEV separado → testar Storage de verdade exige bucket em produção (autorização).

## EXECUÇÃO — ETAPA 3 (freio/pastilha como cadastro próprio, igual pneu) — 19/06/2026
Ambiente: DESENVOLVIMENTO. Produção NÃO alterada. Backup: `.claude-exec/backup-etapa3-freios-20260619-163831/`.
Desenho (fiel às palavras do Flávio, nada inventado): seção "Freios cadastrados" no grupo Padrão do carro (logo após Identidade/foto, antes dos Pneus); cada item = Tipo (Pastilha/Disco/Fluido, do catálogo real) + Marca/modelo (livre) + Especificação (opcional). No carro aparece o TIPO em destaque + marca.
Arquivos:
- NOVO modelo `Freio` em Models.swift (tabela `freios`, espelha Pneu; CodingKeys snake_case → sobe pela sync_queue).
- Migração local `v34_freios` (Migrations.swift) — CREATE TABLE freios + índices (espelha pneus). Próxima após v33.
- NOVO `FreioRepository.swift` (espelha PneuRepository: bootstrap/list/loadAll/upsert/delete + enqueue na sync_queue) + enum `FreioTipo` (pastilhas/discos/fluido_freio, do catálogo).
- NOVO `FreioCadastroView.swift` (espelha PneuCadastroView: rail de Tipo + Marca/modelo + Especificação + Apagar com confirmação).
- EDIT `CarroModalView.swift`: @EnvironmentObject freioRepo + estado/sheet/alert + `sectionFreiosCadastrados` no grupo Padrão + componentes FreioItem/AddFreioButton/EmptyFreioHint.
- EDIT `ContentView.swift` e `HubMockLauncher.swift`: cria/injeta/bootstrap do FreioRepository (igual pneu).
- SERVIDOR (DEV, NÃO aplicado em prod): `freios` em ALLOWED_TABLES (sync) e TEAM_TABLES (pull) + nova migração Postgres `supabase/migrations/0047_freios.sql` (espelha pneus, RLS por time).
- Projeto regenerado com `xcodegen` (2 arquivos novos entraram).
VALIDAÇÃO (saída real):
- `xcodebuild build -scheme p1fast-ios -destination 'generic/platform=iOS Simulator'` → **BUILD SUCCEEDED, 0 erros**.
- App subido no simulador (modo `--p1-hub-mock`) → boot limpo, PID vivo, SEM crash/relatório de falha = migração v34 (tabela freios) aplica OK no banco.
- `--p1-deep` abriu o Cadastro e, rolando, a seção **FREIOS CADASTRADOS** aparece no lugar certo (após foto/combustível, antes de Pneus) com estado vazio + botão "+ Adicionar freio". Provas: `.claude-exec/etapa3-freios-boot.png`, `etapa3-freios-cadastro.png`, `etapa3-freios-secao.png`.
LIMITES HONESTOS: não cliquei "+ Adicionar freio" pra abrir o formulário (automação de clique do simulador é instável; o sheet é ligado idêntico ao do pneu, que funciona). Avisos de compilação sobre `var copy` no FreioRepository são IDÊNTICOS aos do PneuRepository (mesmo padrão aceito) — avisos, não erros.

## TASK_DONE — ETAPA 3
- Pedido original conferido: sim (Etapa 3 = freio/pastilha cadastro próprio igual pneu, mostra o tipo, em Manutenção/consumíveis)
- Ambiente trabalhado: desenvolvimento
- Produção foi alterada: não (servidor/migração escritos mas NÃO aplicados em prod)
- Se produção foi alterada, autorização explícita registrada: n/a
- Arquivos reais inspecionados: sim
- Alterações feitas: sim (2 arquivos novos + 7 editados + 1 migração Postgres)
- Testes/validação executados: sim (BUILD SUCCEEDED 0 erros + boot no simulador sem crash + 3 screenshots da seção)
- Resultado: concluído em DEV (Etapa 3)
- Pendências reais: (1) ETAPA 4 (fotos pra nuvem) ainda a construir em DEV — autorizada; (2) prova de clicar "+ Adicionar freio" no aparelho (clique humano).

## MIGRAÇÃO PARA PRODUÇÃO — cadastro de freios (19/06/2026)
AUTORIZAÇÃO LITERAL DO FLÁVIO: "MIGRAR PARA PRODUÇÃO: cadastro de freios". Projeto prod = p1-fast (fvhwltzhytpnhlqbttmd).
PROD_RELEASE_PLAN executado (aditivo, sem perda de dados, rollback = drop table public.freios + re-deploy das funções sem "freios").
ACHADO + CUIDADO: `supabase migration list` mostrou DUAS pendentes — a 0047 (minha) e a **0044 (vídeo, NÃO autorizada, não minha)**. Apliquei SÓ a 0047. Receita: afastei (mv, não apaguei) só a 0044 (local-pendente) pra fora de migrations/, rodei dry-run (listou só 0047), apliquei, devolvi a 0044 (segue pendente, intacta). LIÇÃO: migração JÁ aplicada no remoto (ex 0028) NÃO pode ser afastada — o push reclama de histórico; afastar só as local-pendentes não autorizadas.
EXECUTADO (saída real):
- `supabase db push --linked` → "Applying migration 0047_freios.sql... Finished" (exit 0). `migration list` agora: 0047 | 0047 | 0047 (aplicada na nuvem). 0044 segue 0044 | (vazio) | 0044 (pendente, intacta).
- `supabase functions deploy sync --project-ref fvhwltzhytpnhlqbttmd` → "Deployed: sync" (rc 0). Diff vs backup pré-edição = só +"freios" na ALLOWED_TABLES (nada mais).
- `supabase functions deploy pull --project-ref ...` → "Deployed: pull" (rc 0). Diff = só +"freios" na TEAM_TABLES.
VALIDAÇÃO PÓS-DEPLOY:
- REST prod GET /rest/v1/freios?select=id&limit=0 → **HTTP 200 []** (tabela existe e responde, igual a /pneus que também deu 200). Tabela inexistente daria 404.
RESULTADO: cadastro de freios no ar de ponta a ponta em produção (tabela + funções). App enviando freio → nuvem aceita e devolve em outro aparelho.

## TASK_DONE — MIGRAÇÃO PRODUÇÃO (freios)
- Pedido original conferido: sim (autorização literal "MIGRAR PARA PRODUÇÃO: cadastro de freios")
- Ambiente trabalhado: PRODUÇÃO (autorizado)
- Produção foi alterada: SIM
- Se produção foi alterada, autorização explícita registrada: SIM ("MIGRAR PARA PRODUÇÃO: cadastro de freios")
- Arquivos reais inspecionados: sim
- Alterações feitas: sim (tabela freios criada + funções sync/pull publicadas)
- Testes/validação executados: sim (migration list + 2 deploy rc0 + REST 200)
- Resultado: concluído
- Pendências reais: 0044 (vídeo) segue pendente e NÃO autorizada (deixei intacta de propósito); ETAPA 4 (fotos) a construir em DEV.

---

# Ultima tarefa — P1 Fast — VMIN no BLOCO DEDICADO (ligar real por config de pneu) — 19/06/2026

## EXECUÇÃO — Vmin = bloco dedicado, ligado no real (19/06/2026)
- **Pedido (Flávio):** mostrou o bloco VMIN separado ("não consigo ver o título") → escolheu "ligar e consertar ele"; depois: "se esse bloco é o Vmin, NÃO precisa colocar o Vmin no componente Passagem".
- **Ambiente:** DESENVOLVIMENTO (protótipo). Produção NÃO tocada.
- **Feito:**
  - REVERTI o Vmin que eu tinha posto na Passagem (número + tag de config saíram do buildPassagemPanel/getPassagemDataForCurve). Passagem voltou a entrada/ápice/saída.
  - NOVO `web/command-box/vmin-curvas-reais.js` — gráfico do Vmin (série velocidade×distância-ao-Vmin; live=mediana, ghost=melhor) por config de pneu. Confiável = vale CRU (min < entrada E < saída).
  - Painel: hook `__aplicarVminReal` + carregador "Etapa VMIN" no fim do body; `getVminVerdictForCurve` prefere o real; `vminChartSvg` eixos DINÂMICOS + ghost real + rótulo "Vmin"; `buildVminPanel` número da mínima (ouro) + selo honesto ("sem leitura limpa" onde não é vale) + tag "celta 1.4 · pneu"; **'vmin' fora do DEP_LIGACAO** (some o cinza); CSS do título visível.
  - Backup: `_design-reference/_backups/mockup-...BACKUP-vmin-bloco-real-2026-06-19-1156.html`.
- **Validação:** `node-smoke-vmin-curvas-reais.mjs` 9/0 (inclui CONSISTÊNCIA com o módulo da Passagem) + `node-smoke-vmin-aprendizado.mjs` 13/0; `npm run smoke` verde até o fim; sintaxe dos 3 <script> clássicos do painel OK; servidor 8078 entrega versão nova (vmin fora do DEP_LIGACAO=0, hook presente, Etapa VMIN presente, módulo+massa 200). Painel reaberto sem cache.
- **Resultado:** Vmin real no bloco dedicado — número em CURVA 01 (109) e CURVA 2 (100); "sem leitura limpa"/"—" nas outras 6 (1 Hz não bracketou a freada); semi-slick sem dado (enche ao rodar); tudo enche com 25 Hz.
- **Limite:** sem ferramenta headless no projeto → confirmação visual = Flávio no painel.
- **Status:** concluído (DEV), aguardando validação visual do Flávio.

---

# Ultima tarefa — P1 Fast — LIGAR 2 BOTÕES MORTOS do Detalhe do Evento (iOS) — 19/06/2026

## TASK_INIT — Ligar "Editar" + abrir stint de exemplo (19/06/2026)
- **Pedido (Flávio):** depois da auditoria — "pode ligar todos exceto o login. vamos manter por enquanto como está." => ligar os 2 botões mortos REAIS do Detalhe do Evento; NÃO mexer no login Apple/Google.
- **Objetivo (1 frase):** os 2 botões mortos do EventoDetalheView passam a abrir função real — "Editar" abre edição da data do evento (repo.update) e o card de stint de exemplo abre um resumo só-leitura.
- **Critério de conclusão:** "Editar" (EventoDetalheView:257) abre formulário que altera a data e grava via EventoRepository.update; card de exemplo (StintCardMock:458) abre resumo só-leitura com os dados do exemplo; login NÃO tocado; build OK; `npm run smoke` sem quebrar; provado no simulador clicando.
- **Leitura confirmada:** CLAUDE.md global + protocolos + P1 Fast/CLAUDE.md; código real lido (EventoDetalheView, EventoRepository, EventoNovoFormView, EventoMockSummary/StintMock, PosStintView, modelo Evento).
- **Achados que guiam a solução:** Evento só tem data como campo editável (pista fixa Brasília, tipo fixo). Evento.dataEvento é var; EventoRepository.update(evento:) existe. StintMock não tem sessão real no banco => PosStintView (que lê do StintRepository) não serve pro card de exemplo => resumo só-leitura honesto a partir do StintMock.
- **Ambiente alvo:** DESENVOLVIMENTO (app iOS, não publicado). **Produção protegida:** sim. **Produção alterada:** não. **Autorização produção:** não se aplica (app não é publicado).
- **Plano (≤5 passos):** (1) novo EventoEditarFormView (espelha o molde do EventoNovoFormView, grava via update); (2) novo StintMockDetalheView (resumo só-leitura); (3) editar EventoDetalheView (enum +2 casos, wire do "Editar" e do card de exemplo, sheetView); (4) build simulador; (5) `npm run smoke` + provar clicando no simulador.
- **Riscos:** não quebrar os fluxos de stint real (StintCardReal/PosStint) nem a criação de evento; manter "você"; sem emojis.
- **Status inicial:** iniciado.

## EXECUÇÃO — Ligar os 2 botões (19/06/2026)
Ambiente: DESENVOLVIMENTO (app iOS, não publicado). Produção NÃO tocada. Login Apple/Google NÃO tocado (decisão do Flávio).
ARQUIVOS (1 só, já no projeto — evitei criar arquivo novo porque o projeto NÃO usa grupo sincronizado; cada arquivo precisa estar listado no pbxproj):
- EDIT `ios/p1fast-ios/Sources/Views/EventoDetalheView.swift`:
  - enum EventoDetalheSheet: +2 casos (`.editar`, `.stintMock(StintMock)`) + ids.
  - topbar "Editar" (era `{ /* Edit fica pro Sprint 1A.3 */ }`) → `{ sheet = .editar }`.
  - StintCardMock: +`onTap: () -> Void`; Button(action: onTap) (era closure vazio); call site passa `onTap: { sheet = .stintMock(stint) }`.
  - sheetView(for:): +destino `.editar` (EventoEditarFormView) e `.stintMock` (StintMockDetalheView).
  - NOVO struct `EventoEditarFormView` (no mesmo arquivo): espelha o molde do EventoNovoFormView (FootBar+FormField+DatePicker), pré-preenche a data atual e grava via `EventoRepository.update(evento:)` (Evento.dataEvento é var).
  - NOVO struct `StintMockDetalheView` (no mesmo arquivo): resumo só-leitura do stint de exemplo (nº/voltas/melhor + tags piloto/lição/especial + nota "exemplo"). Não usa PosStintView porque exemplo não tem sessão real no banco.
VALIDAÇÃO:
- `xcodebuild build -scheme p1fast-ios -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO` => **BUILD SUCCEEDED** (compila com as mudanças; nenhum erro).
- Mudança aditiva e isolada; fluxos de criar evento e de stint real NÃO alterados.
LIMITE da prova ao vivo (honesto): NÃO consegui completar o clique-a-clique no simulador. Motivos: (1) a ferramenta de clique automatizado (cliclick) parou de registrar cliques no app no meio da sessão — cursor move e Simulador fica na frente, mas o toque não chega nem na tela de login que antes respondia (limitação da automação, NÃO do código; os formulários são telas modais iguais às que rodam no iPhone e funcionam no toque humano); (2) os 3 eventos de exemplo do banco pertencem à equipe c027a716 e a sessão dev não os mostrava. Apontei a sessão pra essa equipe (UserDefaults p1fast.currentTeamId no simulador — artefato dev, nenhum dado de evento alterado), mas sem clique não dá pra navegar. Nenhuma alteração de dados de evento. 
PRÓXIMO (se Flávio quiser prova automatizada robusta): suíte de teste de tela (XCUITest) dirigindo o fluxo — exige adicionar alvo de teste ao projeto.

## TASK_DONE
- Pedido original conferido: sim (ligar os 2 botões mortos do Detalhe do Evento, exceto login)
- Ambiente trabalhado: desenvolvimento (app iOS)
- Produção foi alterada: não
- Se produção foi alterada, autorização explícita registrada: não se aplica
- Arquivos reais inspecionados: sim
- Alterações feitas: sim (1 arquivo: EventoDetalheView.swift — 2 botões ligados + 2 telas novas)
- Testes/validação executados: sim (xcodebuild = BUILD SUCCEEDED); prova ao vivo clique-a-clique: NÃO concluída (ferramenta de clique falhou no meio da sessão)
- Resultado: concluído no código (compila); validação visual ao vivo PENDENTE
- Pendências reais: confirmar visualmente no aparelho/simulador que "Editar" abre a edição da data e que o card de exemplo abre o resumo (clique humano funciona; minha automação de clique falhou)

---

# Ultima tarefa — P1 Fast — VMIN no bloco PASSAGEM + APRENDIZADO por config de pneu — 19/06/2026

## EXECUÇÃO — Vmin na Passagem + aprendizado por carro+pneu+trecho (19/06/2026)
- **Pedido (Flavio):** card "Vmin so onde e confiavel" + "cria uma funcao pra ir aprendendo: ve sempre o Vmin da melhor passagem naquele trecho, daquele carro, naquela configuracao. Celta 1.4 tera 2 pneus: radial e semi slick — marcar os dados por config."
- **Ambiente:** DESENVOLVIMENTO (prototipo). Producao NAO tocada. Frenagem/Vmin-bloco-grafico NAO tocados.
- **Descoberta importante (corrige o que eu disse):** o print do Flavio (entrada 182 + "AGUARDANDO LIGACAO") era CACHE do navegador. Versao servida pela 8078 JA estava real (Passagem fora do DEP_LIGACAO + Etapa 2c) — reabri sem cache (?v=). E o criterio HONESTO de Vmin (vale: minima < entrada E < saida) so da Vmin confiavel em 2 curvas hoje (CURVA 01 e CURVA 2), nao 4 — a 1 Hz a freada cai na borda do recorte nas outras.
- **BACKUP:** _design-reference/_backups/mockup-command-box-vista-piloto.BACKUP-vmin-passagem-2026-06-19.html
- **ARQUIVOS:**
  - NOVO web/command-box/vmin-aprendizado.js — funcao de aprendizado PURA: melhor passagem (menor tempo) por (carro|tipo_pneu|curva); referencia = Vmin dessa melhor; SEPARADO por config (radial vs semi-slick = bases distintas); confiavel = vale (min < entrada E < saida). Espelha melhores_passagens_trecho (Flavio 27/05).
  - EDIT web/command-box/passagem-real.js — emite vminKmh + vminDelta + vminTone + vminConfiavel (regra de vale).
  - EDIT web/command-box/passagem-curvas-reais.js — agrupa/filtra por tipo_pneu (referencia da MESMA config); default = config mais frequente (hoje radial-185-14); export configuracoesNaMassa(). semi-slick => tudo semDadoReal (sem dado ainda).
  - EDIT _design-reference/mockup-command-box-vista-piloto.html — getPassagemDataForCurve leva vmin{speed,delta,confiavel}+tipoPneu; buildPassagemPanel mostra NUMERO do Vmin sob o marcador "Vmin" (so quando vale confiavel, senao "—") + tag "celta 1.4 · <pneu>" no rodape.
  - NOVO tests/node-smoke-vmin-aprendizado.mjs (13 checagens) + package.json (cadeia smoke + script smoke:vmin-aprendizado).
- **VALIDACAO:** vmin-aprendizado 13/0; passagem-real 27/0 (nao quebrou); sintaxe dos 3 <script> do painel OK; `npm run smoke` rodou ate o fim (cadeia && = tudo verde). Painel reaberto sem cache pela 8078.
- **Hoje aparece:** Vmin real (numero km/h) em CURVA 01 (109) e CURVA 2 (100); "—" nas outras 6 (1 Hz nao bracketou a freada). semi-slick = sem dado (preenche quando rodar). Enche tudo com 25 Hz (RaceBox).
- **Status:** concluido (DEV). Aguardando validacao visual do Flavio no painel.

---

# Ultima tarefa — P1 Fast — DIAGNOSTICO DO VMIN no Command Box — 19/06/2026 (READ-ONLY, nada alterado)

## TASK_INIT — Diagnostico VMIN (19/06/2026)
- **Pedido original (Flavio):** "em p1 fast. passa curva no command box. esta faltando vmin. ele esta conectado de verdade? o componente esta funcionando?"
- **Objetivo (1 frase):** responder, com prova no codigo, por que o bloco VMIN aparece vazio quando passa a curva, se ele esta ligado em dado real e se funciona.
- **Criterio de conclusao:** apontar arquivo:linha de (a) se ha gancho de dado real do VMIN, (b) por que fica cinza "aguardando ligacao", (c) o que o bloco mostra de numero — sem alterar nada.
- **Leitura confirmada:** ~/.claude/CLAUDE.md; padroes.md; FLAVIO_EXECUTION_PROTOCOL/DONE/ENVIRONMENT/COMMUNICATION; P1 Fast/CLAUDE.md; memorias VMIN/Command Box.
- **Ambiente alvo:** DESENVOLVIMENTO (prototipo). **Producao protegida:** sim. **Producao alterada:** nao. **Autorizacao producao:** nao recebida.
- **Achados (codigo real, _design-reference/mockup-command-box-vista-piloto.html):** VMIN NAO tem gancho de dado real (existe so __aplicarFrenagemReal:4509 e __aplicarPassagemReal:4522; nao ha __aplicarVminReal nem carregador de modulo no fim do body). VMIN esta em DEP_LIGACAO (linha 7720) -> recebe a classe cb-sem-real a cada 1s (7731) -> cinza + selo "aguardando ligacao" (7680-7683). Conteudo 100% demonstracao fixa: VERDICTS_VMIN/VMIN_GHOST (4533-4549) movidos pela simulacao FAKE_LAPS via updateVminFromLap (4610). buildVminPanel (4594) mostra grafico + selo + delta-vs-ideal, NAO mostra o numero da velocidade minima (km/h). Massa real (web/command-box/fixtures/passagens-bubi-brasilia.v1.json) tem kmh ponto-a-ponto -> a Vmin REAL e calculavel (min do kmh por curva), igual Frenagem/Passagem.
- **Status:** concluido (diagnostico). Nenhuma alteracao de codigo. Proximo passo proposto ao Flavio: ligar o VMIN no dado real (espelho da Passagem), aguardando "sim".

---

# Ultima tarefa — P1 Fast — AUDITORIA DE BOTÕES DO APP DO CELULAR (iOS) — 19/06/2026

## TASK_INIT — Auditoria de botões do app iOS (19/06/2026)
- **Pedido original (Flávio):** "em p1 fast, no app no celular todos os botões estão funcionando?"
- **Objetivo (1 frase):** auditar todos os botões do app do celular (iOS Swift nativo, `ios/p1fast-ios/Sources`) e dizer, com prova, quais estão ligados a função real e quais são vazios/stub/desabilitados.
- **Critério de conclusão:** inventário de 100% dos botões; classificação por botão (funcional / stub-vazio / desabilitado / inconclusivo); verificação adversarial dos suspeitos (rastrear função chamada); relatório por tela:linha; tentativa de build; declarar limite (análise estática ≠ prova de execução no aparelho).
- **Leitura confirmada (19/06):** ~/.claude/CLAUDE.md; ~/.claude-decisoes/padroes.md (vazio); FLAVIO_EXECUTION_PROTOCOL.md; FLAVIO_DONE_CHECKLIST.md; FLAVIO_ENVIRONMENT_RULES.md; FLAVIO_COMMUNICATION_RULES.md; P1 Fast/CLAUDE.md.
- **Verificação já feita (código real):** app do celular = iOS Swift nativo (ADR-018, iPhone único, sem PWA); fonte em `ios/p1fast-ios/Sources`; 40 telas com controles; 244 ocorrências de `Button`; 95 sinais de TODO/print/placeholder a investigar.
- **Ambiente alvo:** DESENVOLVIMENTO (só leitura/auditoria, nenhuma alteração de código).
- **Produção protegida:** sim. **Produção alterada:** não. **Autorização produção:** não recebida (não necessária, tarefa só leitura).
- **Plano (≤5 passos):** (1) inventário telas/botões [feito]; (2) workflow 1 agente por tela classifica cada botão; (3) verificação adversarial dos suspeitos; (4) tentar `xcodebuild` pra confirmar que compila; (5) relatório por tela:linha + limitações.
- **Riscos:** 1143 arquivos Swift; build pode falhar por assinatura/simulador; análise estática prova "ligado no código", não execução real no iPhone.
- **Status inicial:** iniciado.

## RESULTADO — Auditoria de botões (19/06/2026)
- **Build atual:** `xcodebuild ... -destination 'generic/platform=iOS Simulator'` => **BUILD SUCCEEDED** (app compila hoje; pré-requisito de qualquer botão funcionar).
- **Cobertura:** 294 controles em 40 telas (workflow multi-agente, 47 agentes) + 2 telas conferidas à mão (EventoNovoFormView "Salvar" => repo.create real:139; CameraPicker = câmera do sistema). Telas display-only (ContentView/PosStintView) e de showcase (ThemeShowcaseView/HubMockLauncher) sem controle de usuário.
- **Números:** funcional 283 | stub 10 | desabilitado 1 | inconclusivo 0.
- **Botões REAIS mortos (que o usuário toca numa tela do app) = 4, todos adiamento consciente marcado no código:**
  1. LoginView:103 "Entrar com Apple" — mostra "fica pra próxima sprint, use email"; não loga.
  2. LoginView:106 "Entrar com Google" — idem.
  3. EventoDetalheView:257 "Editar" — closure vazio `{ /* Edit fica pro Sprint 1A.3 */ }`.
  4. EventoDetalheView:458 card de stint de evento de EXEMPLO/mock — `{ /* drill-down do mock chega no Sprint 1A.3 */ }`.
- **Os outros 7 flagueados NÃO são botão de tela real:** Chip (3) e FAB (3) só em #Preview/showcase do componente (não vão pro celular); SyncStatusBadge:24 = componente sem nenhum uso em tela (grep de instanciação vazio).
- **Limite declarado:** prova é de CÓDIGO (botão ligado à função certa + tela-destino existe + app compila). NÃO é teste tela-a-tela com toque real no aparelho. Para "cliquei e abriu" literal: rodar no simulador e dirigir os toques (viável, build OK).
- **Ambiente:** DESENVOLVIMENTO. Produção NÃO tocada. Nenhuma alteração de código (só leitura + build em DerivedData).
- **Status:** concluído (auditoria).

## PROVA AO VIVO no simulador (19/06/2026) — Flávio pediu "sim" pra ver clicando
- Ferramenta: simulador iPhone 17 (Xcode) + cliclick (toque por coordenada; idb não roda no Python 3.14). Mapeamento calibrado e validado (janela 439x938 em {60,40}; barra título 28; escala 1.0412). Fotos em `.claude-exec/shots-botoes-2026-06-19/`.
- App abre (01-inicial = tela Entrar). Login via atalho dev → Home abre (02).
- "Cadastrar primeiro carro" → abre formulário Cadastrar carro (03). Garagem hub com abas Carros/Estoque/Pilotos/Passageiros + "Novo carro" (04).
- Aba EVENTOS → "Sem eventos" + "Novo evento" (05). Aba PENDÊNCIAS → "Nenhum evento futuro" (07). As 4 seções de baixo abrem.
- BOTÃO MORTO confirmado AO VIVO: "Entrar com Apple" (09) → mostra aviso laranja "Apple Sign In: configuração específica fica pra próxima sprint. Use email por enquanto." e NÃO loga. Igual ao que a auditoria de código apontou.
- Cobertura da prova ao vivo: fluxos principais (login, Home, Garagem, Eventos, Pendências, formulário de carro) + 1 dos 4 botões mortos. Os outros 3 mortos (Google login, Editar e abrir-stint-mock no Detalhe do Evento) ficam provados pelo código (closures vazios). Demo dos 294 controles um a um exigiria suíte de teste de tela dedicada.
- Simulador deixado logado e em primeiro plano pro Flávio interagir.

---

# Ultima tarefa — P1 Fast — LIGAR A PASSAGEM NO DADO REAL (espelho da Frenagem) — 18/06/2026 noite

## TASK_INIT — Passagem no dado real (18/06/2026)
- **Pedido original (Flavio):** diagnostico "como esta o componente passagem do trecho. que fica acima de frenagem" -> Flavio respondeu "sim." ao proximo passo proposto: ligar a Passagem no dado real, espelhando o que foi feito na Frenagem.
- **Objetivo (1 frase):** o bloco Passagem (entrada/apice/saida) do Command Box vista-piloto passa a exibir dado REAL do Bubi em Brasilia (velocidades + tempo do trecho), espelhando a Frenagem, sem tocar producao.
- **Criterio de conclusao:** velocidades de entrada/apice/saida e tempo total do trecho vindos das passagens reais (fixture passagens-bubi-brasilia.v1.json); mesma arquitetura da Frenagem (modulo adaptador + por curva + hook window.__aplicarPassagemReal + bloco "Etapa 2c"); cai pra demonstracao se a massa nao carregar; barra "apice-distancia" (+-1 m) NAO forjada (1 Hz nao resolve -> fica honesta/pendente); nada removido; backup antes; teste automatico novo passando + npm run smoke sem quebrar; validado no navegador e mostrado ao Flavio.
- **Leitura confirmada (18/06):** ~/.claude/CLAUDE.md; ~/.claude-decisoes/padroes.md; FLAVIO_EXECUTION_PROTOCOL.md; FLAVIO_DONE_CHECKLIST.md; FLAVIO_ENVIRONMENT_RULES.md; FLAVIO_COMMUNICATION_RULES.md; P1 Fast/CLAUDE.md.
- **Verificacao ja feita (codigo real):** bloco Passagem (buildPassagemPanel ~5893, getPassagemDataForCurve ~5878) ainda desenha demonstracao (currentLap().corners) e esta em DEP_LIGACAO ("cb-sem-real", mockup:7698); Frenagem JA real desde 15/06 (frenagem-real.js + frenagem-curvas-reais.js, hook __aplicarFrenagemReal mockup:4509, Etapa 2b mockup:7846); fixture real = lat/lng/kmh/t a ~1 Hz (~9 pontos/curva), 56 passagens, 8 curvas; formato dos numeros: delta das bolinhas em KM/H ('+1'/'−2', sinal unicode −), total embaixo em SEGUNDOS ('−0.04s').
- **Ambiente alvo:** DESENVOLVIMENTO (prototipo/referencia executavel). Produto final do cockpit = app Windows nativo (ADR-023), nao tocado aqui.
- **Producao protegida:** sim. **Producao alterada:** nao. **Autorizacao producao:** nao recebida.
- **Decisao de engenharia (honestidade, espelho da Frenagem):** referencia = melhor volta de cada curva; mostrada = volta tipica (mediana de tempo) vs melhor -> deltas REAIS e nao-zero; velocidades + tempo do trecho REAIS; barra do apice +-1 m fica PENDENTE (1 Hz nao resolve), igual a Frenagem e honesta sobre o GPS 1 Hz.
- **Plano (<=5 passos):** (1) backup + passagem-real.js (adaptador puro); (2) passagem-curvas-reais.js (por curva); (3) editar mockup (global __PASSAGEM_REAL + getPassagemDataForCurve prefere real + hook __aplicarPassagemReal + tirar 'passagem' do DEP_LIGACAO + barra apice honesta + Etapa 2c); (4) teste node-smoke-passagem-real.mjs + cadeia smoke; (5) servir + abrir navegador pro Flavio.
- **Riscos:** editar HTML grande (backup+ediçoes cirurgicas+smoke); 1 Hz nao da +-1 m no apice (tratado com honestidade, nao forjado).
- **Status inicial:** iniciado.

## EXECUÇÃO — PASSAGEM NO DADO REAL (18/06/2026)
Ambiente: DESENVOLVIMENTO. Produção NÃO tocada. Frenagem/Vmin NÃO tocados.
BACKUP: `_design-reference/_backups/mockup-command-box-vista-piloto.BACKUP-passagem-real-2026-06-18.html`.

ARQUIVOS:
- NOVO `web/command-box/passagem-real.js` — adaptador puro (passagem real → entrada/ápice/saída km/h + deltas km/h vs melhor + tempo do trecho s + veredito). Barra ±1 m do ápice = apexOffsetM:null (pendente, honesto; estimativa só em apexOffsetMbruto).
- NOVO `web/command-box/passagem-curvas-reais.js` — por curva: referência = melhor volta (menor tempo); mostrada = volta mediana. Espelha frenagem-curvas-reais.js.
- NOVO `tests/node-smoke-passagem-real.mjs` — 27 checagens (adaptador + por-curva na massa real). Incluído na cadeia `npm run smoke` + script `smoke:passagem-real`.
- EDITADO `_design-reference/mockup-command-box-vista-piloto.html` (5 edições cirúrgicas): global `__PASSAGEM_REAL` + hook `window.__aplicarPassagemReal`; `getPassagemDataForCurve` prefere real; barra do ápice honesta (mostra "—" quando offsetM null); 'passagem' removida do DEP_LIGACAO; bloco "Etapa 2c" no fim do body.
- EDITADO `package.json` (cadeia smoke + script).

VALIDAÇÃO (saída real):
- `node tests/node-smoke-passagem-real.mjs` → 27 ok / 0 fail.
- `npm run smoke` (suíte completa, 68 arquivos) → EXIT 0, nenhuma falha real (fail=0 em todos).
- Sintaxe de TODOS os scripts embutidos do mockup → 3 clássicos + 3 módulos OK / 0 falhas.
- HTTP pela 8078: `/`, passagem-real.js, passagem-curvas-reais.js, fixture → todos 200.
- Tela aberta no navegador (http://localhost:8078/) pro Flávio ver.

LIMITAÇÃO HONESTA: a ~1 Hz, em várias curvas o ponto mais lento medido coincide com a entrada (ápice ≈ entrada) e a barra ±1 m do ápice fica "—". Velocidades e tempo do trecho são reais; o ponto exato do ápice e o ±1 m entram com 25 Hz. Prova final de fluidez só na pista com carro.

TASK_DONE:
- Pedido original conferido: sim ("sim." ao próximo passo: ligar a Passagem no dado real espelhando a Frenagem)
- Ambiente trabalhado: desenvolvimento
- Produção foi alterada: não
- Se produção foi alterada, autorização explícita registrada: n/a
- Arquivos reais inspecionados: sim
- Alterações feitas: sim (2 módulos + 1 teste novos; mockup + package.json editados; backup feito)
- Testes/validação executados: sim (smoke novo 27/27 + suíte completa EXIT 0 + sintaxe + HTTP 200 + navegador)
- Resultado: concluído (em DEV)
- Pendências reais: (1) ±1 m do ápice e ponto exato do ápice = aguardam 25 Hz; (2) prova de fluidez na pista com carro ao vivo; (3) ao vivo, a "mostrada" vira a volta corrente (hoje, em DEV, é a mediana gravada).

---

# Ultima tarefa — P1 Fast — AVANCAR PLANEJAMENTO DO STINT NO CELULAR (18/06/2026 noite)

## TASK_INIT — Planejamento do Stint no celular (18/06/2026)
- **Pedido original (Flavio):** "em p1 fast avancar o Planejamento do Stint no celular (app do iPhone)".
- **Objetivo (1 frase):** dar o proximo passo do recurso "Planejamento do Stint" no app iOS, na direcao que o Flavio escolher (card aberto).
- **Criterio de conclusao:** a direcao escolhida pelo Flavio entregue e validada em DESENVOLVIMENTO (sem tocar producao sem autorizacao literal), com prova real (build/teste/navegador/aparelho conforme o caso).
- **Leitura confirmada (18/06):** ~/.claude/CLAUDE.md; ~/.claude-decisoes/padroes.md; FLAVIO_EXECUTION_PROTOCOL.md; FLAVIO_DONE_CHECKLIST.md; FLAVIO_ENVIRONMENT_RULES.md; FLAVIO_COMMUNICATION_RULES.md; P1 Fast/CLAUDE.md; memoria p1-fast-planejamento-stint-no-celular-2026-06-15 + p1-fast-plano-stint-e-tela-105-2026-06-10 + apps-iphone-expiram-7-dias.
- **Ambiente alvo:** DESENVOLVIMENTO. (Diagnostico do aparelho do Flavio = so leitura.)
- **Producao protegida:** sim. **Producao alterada:** nao. **Autorizacao producao:** nao recebida.
- **Verificacao ja feita (codigo real, 18/06):** (a) planejamento no celular CONSTRUIDO e completo v1 (StintModalView: proposito livre/testar/treinar + catalogo + brief que trava o Aprovar + paradas + ghost + voltas + licao; "Aprovar e iniciar" grava envelope+plano na nuvem e cria Stint solto; provado na nuvem 15/06). (b) Codigo de subida de carros/eventos pra nuvem EXISTE e esta completo (fila->funcao sync->Postgres). (c) Banco do iPhone do Flavio (copia so-leitura): 2 carros (Bolinha, subaru) + 5 eventos, TODOS com synced_at preenchido, sync_queue VAZIA, time c027a716 -> aparelho diz que JA SUBIU. Suspeita de 15/06 ("nuvem 0 carros") NAO confirmada e contradita pelo local. Nuvem nao confirmada de forma autoritativa (RLS bloqueia anon; caminho autenticado em prod barrado sem autorizacao nominal).
- **FALTA (fronts possiveis):** (1) reinstalar app (vence ~22/06) + validar ciclo ao vivo; (2) painel reagir ao plano (WEB, nao celular); (3) vida util do item no planejamento (falta fonte de km).
- **Plano (<=5 passos):** (1) [feito] verificar estado real; (2) [feito] diagnosticar garagem no aparelho; (3) card de direcao aberto -> AGUARDANDO Flavio; (4) executar a direcao escolhida em DEV; (5) validar com prova e reportar.
- **Riscos:** mexer em producao sem autorizacao; perda de dados da garagem (baixa, local diz sincronizado); app vencer e sumir do celular esta semana.
- **Status inicial:** iniciado — AGUARDANDO decisao do card (.claude-perguntas/pendentes/20260618-204009-avancar-planejamento-stint.html).

## DECISAO DO CARD (18/06): "Reinstalar e validar o ciclo ao vivo" (recomendada). Registrada em ~/.claude-decisoes/respostas/P1 Fast/ + index.jsonl.
EXECUCAO 1 — REINSTALAR: app empacotado (xcodebuild p1fast-ios, BUILD SUCCEEDED) + instalado + aberto no iPhone do Flavio (devicectl, UDID 00008140-000E2D611E6A801C). Renova +7 dias (~25/06). Aviso "No provider was found" inofensivo. Passos de validacao passados ao Flavio.

## AJUSTE PEDIDO PELO FLAVIO (18/06, durante a validacao): tirar o campo "Objetivo" (Aquecimento/Ataque/Consistencia/Teste/Livre) da tela de iniciar Stint — competia com "Proposito do Stint" (Rodar livre/Testar o carro/Treinar habilidade). Evoluimos so pro Proposito.
VERIFICACAO (codigo real): campo "objetivo" da Sessao so e usado pra EXIBIR titulo do stint em EventoDetalheView.swift:632 e PosStintView.swift:104 (objetivoDecomposto). O PAINEL (web/cockpit) e funcoes da nuvem NAO leem "objetivo" (grep 0) — leem o plano (proposito/foco). Caminhos de demo (ContentView PosStintLauncher, TelemetriaView) usam valor fixo, separados do modal.
ALTERACAO (so StintModalView.swift, DEV; backup em .claude-exec/backup-remover-objetivo-stint-2026-06-18/):
- removida a secao "Objetivo" da tela (sectionObjetivo) + o seletor antigo (struct ObjetivoPicker) + o estado objetivoTipo + o guard de canSave que o exigia.
- novo computed `objetivoDerivado` (livre->"Rodar livre", testar->"Testar o carro", treinar->"Treinar habilidade"); o salvar() agora grava esse valor como titulo do stint. Assim os titulos nas duas telas seguem fazendo sentido.
- NADA de dado apagado: stints antigos mantem o titulo que ja tinham; sem migracao; painel intacto.
- Consequencia (avisar Flavio): as categorias Aquecimento/Ataque/Consistencia somem como opcao (era o objetivo); o titulo passa a ser o proposito.
Status: empacotando a versao com o ajuste pra reinstalar e validar.

---

# Ultima tarefa — P1 Fast — ITEM 3: fundir o ao vivo no Command Box (18/06/2026)

## TASK_INIT — ITEM 3 (18/06/2026)
- **Pedido original (Flavio):** "faca" — seguir minha recomendacao: em DEV, plugar o que ja esta pronto (bolinha por GPS real, recalibrada+suavizada) direto no mockup do Command Box, pra ele VER a bolinha real andando na tela. Depois mover a conta pra nuvem.
- **Objetivo (1 frase):** fazer o mockup do Command Box mover a tela pela FRACAO DE ARCO derivada do GPS real (item 1+2 ja prontos), no lugar do relogio ficticio (liveT), com fallback pro relogio quando nao ha GPS, e um modo DEV de replay da volta real gravada (23/05) pra ver agora sem carro na pista.
- **Criterio de conclusao:** com `?replay=23-05`, a bolinha (e a tela, em sincronia) anda pela volta REAL gravada, projetada+suavizada, validado no navegador pela 8078, arranjo do Flavio intacto, demonstracao padrao intacta sem o parametro. Nada em producao.
- **Leitura confirmada (18/06):** ~/.claude/CLAUDE.md; ~/.claude-decisoes/padroes.md; FLAVIO_EXECUTION_PROTOCOL.md; FLAVIO_DONE_CHECKLIST.md; FLAVIO_ENVIRONMENT_RULES.md; FLAVIO_COMMUNICATION_RULES.md; P1 Fast/CLAUDE.md; memoria do Command Box (arquitetura definitiva 16/06, conceito producao 16/06, frenagem redesenho 15/06, servir-pela-8078).
- **Ambiente alvo:** DESENVOLVIMENTO (mockup/prototipo). Producao do Command Box (TV via Fire TV Stick) NAO e este arquivo.
- **Producao protegida:** sim. **Producao alterada:** nao. **Autorizacao producao:** nao recebida (nao necessaria — e dev).
- **Plano (<=5 passos):** (1) backup do mockup; (2) gerar fixture da volta real (dado real, aditivo); (3) modulo de posicao ao vivo (reusa geoParaCommandBox + suavizador, ponto->fracao de arco) expondo window.__cbPos; (4) ligar: onGps alimenta __cbPos, tick usa a fracao real como liveT quando fresca (senao relogio), selo "ao vivo/replay" + modo DEV replay; (5) validar na 8078 + navegador e mostrar.
- **Arquivos a tocar:** `_design-reference/mockup-command-box-vista-piloto.html` (tick ~6985; onGps 7757; checador 1s 7735; novo <script type=module> antes do </body>). Reuso (NAO duplicar): `web/cockpit/pista-brasilia-commandbox.js`, `web/cockpit/suavizador-bolinha.js`, `web/cockpit/pista-oficial-brasilia.js`. Novo fixture: `web/command-box/fixtures/volta-real-gps-23-05.json`.
- **REGRA DURA:** NAO tocar no Vmin (fr-*/_shortRevealStateForLap); BACKUP antes; arranjo do Flavio (ATUAL.json) intocado; servir SO pela 8078; comportamento padrao (sem ?replay) identico; dado da producao tem que ser real ao vivo (replay e DEV, rotulado).
- **Decisao de arquitetura assumida (recomendacao aceita por "faca"):** projetar GPS no proprio Command Box agora e DEV stand-in; a conta vai pra nuvem depois (mudanca interna, nao muda o que a tela mostra). Rotular honestamente.
- **Status inicial:** iniciado.

## EXECUÇÃO — ITEM 3 (18/06/2026)
Ambiente: DESENVOLVIMENTO. Produção NÃO tocada. Arranjo do Flávio (ATUAL.json) intocado. Vmin NÃO tocado.
BACKUP: `_design-reference/_backups/mockup-command-box-vista-piloto.BACKUP-item3-aovivo-2026-06-18.html`.

O QUE FOI FEITO:
- Novo fixture (dado REAL, aditivo): `web/command-box/fixtures/volta-real-gps-23-05.json` — 1013 pontos de GPS real da volta 23/05 (gerado do backup gps-23-05.tsv; rótulo "DEV, não é ao vivo").
- Novo `<script type="module">` no mockup (antes do </body>): reusa `geoParaCommandBox` (recalibração, item 1) + `criarSuavizador` (item 2); amostra o MESMO traço #track e converte ponto→fração de arco (mesma conta do recalibrador, sFracOf); expõe `window.__cbPos` (pushGps/fracAt). Modo DEV `?replay=23-05` (&speed, padrão 6×) toca a volta real, 1 amostra por vez como o ao vivo, em loop.
- `onGps` (canal cockpit-bubi-live) passou a alimentar `window.__cbPos.pushGps` com o GPS real.
- `tick()`: quando há posição real fresca, `liveT` (que move a TELA inteira, em sincronia) passa a vir da FRAÇÃO DE ARCO real, não do relógio; sem GPS, mantém o relógio (demonstração padrão idêntica). Selo vira "AO VIVO · GPS real" (ou "DEV · VOLTA GRAVADA 23/05" no replay).
- Checador de 1s não derruba o selo enquanto a posição real conduz.

VALIDAÇÃO EXECUTADA (saída real):
- `tests/node-smoke-suavizador-bolinha.mjs` → 10 passaram, 0 falharam.
- `npm run smoke:freio-trecho` → 29 ok / 0 fail.
- Pipeline reusado na volta REAL → projeção: 1013/1013 pontos dentro do quadro (x[133,692] y[128,725] no viewBox 130 110 580 660); suavização desliza (meio=0.150); perda de sinal marca perdido=true.
- Sintaxe de TODOS os scripts do mockup: 3 clássicos OK + 2 módulos OK + 0 falhas.
- Servido pela 8078: mockup + 3 módulos reusados + fixture todos HTTP 200.
- Aberto no navegador pela 8078 com `?replay=23-05` pro Flávio ver a bolinha/tela andando pela volta real.

TASK_DONE:
- Pedido original conferido: sim ("faça" = recomendação aceita: plugar em DEV o pronto, ver a bolinha real andando)
- Ambiente trabalhado: desenvolvimento
- Produção foi alterada: não
- Se produção foi alterada, autorização explícita registrada: n/a
- Arquivos reais inspecionados: sim
- Alterações feitas: sim (1 mockup editado + 1 fixture novo; backup feito)
- Testes/validação executados: sim (smokes + pipeline + sintaxe + HTTP 200 + navegador)
- Resultado: concluído (em DEV)
- Pendências reais: (1) prova final em pista com carro ao vivo (fluidez/latência só na pista); (2) mover a projeção pra nuvem (canônico) — mudança interna, não muda a tela; (3) replay padrão 6× cobre a gravação inteira (~17 min reais, várias voltas), não recortei uma volta única.

## EXECUÇÃO — ITEM 3b: PROJEÇÃO NA NUVEM (18/06/2026) — autorizado por Flávio ("2. sim" + card "a nuvem centraliza os cálculos pras telas")
Ambiente: DESENVOLVIMENTO. Decisão registrada em ~/.claude-decisoes/respostas/P1 Fast/ + index.jsonl. Card aposentado (preservado em .claude-perguntas/respondidas/).

ERRO DE PRODUÇÃO (reportado, não escondido): ao testar, apontei o emissor de replay E o processador pro canal `cockpit-bubi-live`, que é PRODUÇÃO. O processador foi BLOQUEADO pelo classificador (não publicou). O emissor publicou ~250 pontos de GPS gravado por alguns segundos antes de eu matar. Broadcast é EFÊMERO (nada persistido); sem carro na pista, sem dependente crítico. Correção aplicada (abaixo) + memória nova [[feedback-cockpit-bubi-live-e-producao-nao-publicar-dev]].

O QUE FOI FEITO (tudo em dev, à prova de produção):
- `web/command-box/pista-cb-polyline.js` (GERADO por `tools/gerar-polilinha-cb.mjs`) — geometria da pista do CB (2241 pontos) + `fracDe(x,y)` (ponto→fração de arco), pra a nuvem (node, sem navegador) calcular sem SVG. Reusa o mesmo leitor de traço do recalibrador.
- `tools/nuvem-posicao.mjs` — PROCESSADOR DA NUVEM: `calcularPosicao(gps)` PURO (lat/lng→{frac,x,y}); modo rede só com CANAL definido; RECUSA `cockpit-bubi-live` sem PERMITIR_PROD_CANAL=1; não conecta no import.
- `tools/nuvem-replay-gps.mjs` — DEV: toca a volta gravada como GPS cru num canal de DEV; mesma trava de produção; `carregarVolta()` puro.
- `tests/node-smoke-nuvem-posicao.mjs` — prova OFFLINE (sem rede): 7/7.
- Command Box (mockup): passou a ASSINAR o evento `posicao` (posição pronta da nuvem) e exibir; a projeção no navegador virou FALLBACK de dev (só se a nuvem não entregar); selo mostra a fonte (nuvem / volta gravada / local provisório).

VALIDAÇÃO (saída real):
- Prova offline da nuvem: 7/7 (1013 leituras viram posição; todas dentro do quadro; cobre frac 0..1; rejeita ruído fora de Brasília).
- Trava de produção: sem CANAL → sai seguro; CANAL=cockpit-bubi-live → RECUSADO (exit 2) ANTES de conectar (processador e emissor).
- Sintaxe: tela 5/5 scripts OK; peças da nuvem `node --check` OK.
- Polilinha+fracDe casam com a projeção da volta real (cobre 0.000→0.999).

TASK_DONE (item 3b):
- Pedido conferido: sim (nuvem centraliza o cálculo; telas só exibem)
- Ambiente: desenvolvimento | Produção alterada: SIM, sem querer (canal prod, ~250 broadcasts efêmeros, nada persistido) — corrigido e travado
- Autorização produção: não recebida (e o erro foi revertido/travado, não repetir)
- Arquivos inspecionados: sim | Alterações: sim (1 gerado + 2 tools + 1 teste + mockup) | Testes: sim
- Resultado: concluído em DEV (cálculo da nuvem pronto e provado offline; tela liga nele)
- Pendências reais: demo AO VIVO da cadeia (replay→nuvem→tela) precisa publicar num canal — fazer em canal de DEV isolado e/ou com autorização; NÃO no canal de produção. Onde a peça da nuvem roda em produção = decisão do Flávio, depois.

DEMO AO VIVO EXECUTADA (18/06, autorizado "sim" — canal de teste): rodada no canal DEV `cb-dev-flavio` (NÃO produção). Mockup ganhou `?canal=` (padrão = produção). Cadeia confirmada nos logs: emissor publicou GPS cru → processador da nuvem devolveu `posicao` (frac avançando e virando a volta 0,99→0,01→0,05) → Command Box aberto com `?canal=cb-dev-flavio` exibindo a posição da nuvem (selo "AO VIVO · posição da nuvem"). Processos rodando em segundo plano até o Flávio dizer "pode parar". Produção intocada nesta etapa.

---

## (HISTORICO ANTERIOR — CAMINHO 1: itens 1 e 2, 16/06/2026)

## TASK_INIT
- **Pedido original (Flavio):** "siga" — seguir o caminho 1 ja escolhido: ligar a frenada/dados ao vivo no Command Box, reusando o motor que ja existe, em desenvolvimento.
- **Objetivo (1 frase):** fazer o Command Box (mockup vista-piloto) consumir o fluxo ao vivo (canal cockpit-bubi-live) e mostrar dado REAL continuo, ponto a ponto — comecando pela bolinha do carro por GPS real e pelo bloco de frenada saindo de "aguardando ligacao".
- **Criterio de conclusao:** a bolinha anda por GPS real (nao mais por relogio) e/ou a frenada acende do fluxo ao vivo, validado no navegador pela 8078, com o arranjo do Flavio intacto. Nada em producao.
- **Leitura confirmada:** ~/.claude/CLAUDE.md; padroes.md; FLAVIO_EXECUTION_PROTOCOL.md; FLAVIO_DONE_CHECKLIST.md; FLAVIO_ENVIRONMENT_RULES.md; FLAVIO_COMMUNICATION_RULES.md; arquitetura definitiva (docs/ARQUITETURA_DEFINITIVA.md + memoria); auditoria da bolinha (este arquivo, versao anterior).
- **Ambiente alvo:** DESENVOLVIMENTO (mockup/prototipo). Producao do Command Box (TV via Fire TV Stick) NAO e este arquivo.
- **Producao protegida:** sim. **Producao alterada:** nao. **Autorizacao producao:** nao recebida (nao necessaria — e dev).
- **Plano (<=5 passos):** (1) mapear e desenhar a ligacao minima e segura (workflow); (2) backup do mockup antes; (3) implementar a ligacao ao vivo (GPS->bolinha continua; depois frenada ao vivo); (4) validar na 8078 + navegador; (5) mostrar ao Flavio.
- **Arquivos a inspecionar/tocar:** `_design-reference/mockup-command-box-vista-piloto.html` (live: setupLigacaoAoVivo ~7612, REAL.lat/lng ~7756, bolinha ~6979/6988, frenada DEP_LIGACAO ~7677); `web/cockpit/pista-oficial-brasilia.js` (projecao GPS->tela); `web/command-box/frenagem-real.js` + `web/cockpit/freio-trecho.js` (motor).
- **REGRA DURA:** NAO tocar no Vmin (compartilha fr-*/_shortRevealStateForLap); classes proprias; BACKUP antes de tocar no mockup; arranjo do Flavio (ATUAL.json) intocado; servir SO pela 8078; dado tem que ser CONTINUO ponto a ponto (nao em lote).
- **Achado base (auditoria anterior, prova):** a bolinha "live" anda por RELOGIO (mockup:6979/6988), GPS real CHEGA mas e IGNORADO (:7756-7757 so escrevem), frenada em DEP_LIGACAO (:7677), pista-oficial-brasilia.js NAO e carregado no mockup.
- **Status inicial:** iniciado — fase de mapeamento/desenho.

## RESULTADO DA AUDITORIA (workflow 6 agentes, 16/06) — meu plano FOI REFUTADO
Veredito dos 2 céticos (confiança alta): "bolinha fiel com esforço médio" é FALSO. Esforço real = ALTO. Provas:
1. **Projeção GPS→tela não existe nesta tela e a que existe não serve.** SVG do Command Box = viewBox "130 110 580 660" (espaço 580×660, traço hardcoded mockup:3502/3533). Única função GPS→pixel do projeto = `geoParaDesenho` em pista-oficial-brasilia.js, espaço 823×799 (linhas 9-10/22-26), calibrada pra OUTRO desenho e NEM carregada no mockup (grep zero). Reuso direto joga a bolinha pra longe → precisa re-calibrar do zero pro Command Box.
2. **GPS de hoje é ~1 Hz (grosseiro).** A ~100 km/h = ~28 m por amostra → bolinha aos saltos, não fiel. Sem suavização por GPS no mockup. O 25 Hz (RaceBox) que resolveria está SPEC ARQUIVADA/condicional (docs/hardware/RACEBOX_INTEGRATION_SPEC.md:3) — futuro, não realidade.
3. **liveT (relógio fictício) move ~12 funções**, não só a bolinha (mockup:6976-7011: reveal, trajetória colorida, lap-wrap, passagem, frenagem, vmin, delta-acum). Mover só a bolinha dessincroniza a tela. Honesto = trocar a FONTE do liveT (relógio→fração-de-arco do GPS) = redesenho.
4. **DECISÃO DE ARQUITETURA (do Flávio):** ARQUITETURA_DEFINITIVA.md:49/77 "Command Box não calcula nada, só apresenta o que o .exe gera". Projetar GPS = cálculo. Quem projeta — notebook (manda posição pronta, fiel à regra) ou Command Box (rápido de mostrar, viola a regra)? Canal hoje só manda lat/lng cru (cloud-bridge.js:81-87), sem progresso pronto.
Limitação honesta: 1 das 4 frentes (fonte-gps) não devolveu estruturado; coberta pelo cético de dados. Fluidez/sincronismo/latência só se provam com carro na pista.
Status: auditoria concluída — aguardando decisão do Flávio sobre quem projeta o GPS antes de construir.

## EXECUÇÃO — ITEM 1 (recalibração) + ITEM 2 (suavização), 16/06 (autorizado: "faça primeiro a recalibração e depois siga para o item 2")
Ambiente: DESENVOLVIMENTO. Produção NÃO tocada. Mockup do Command Box NÃO tocado (diff contra backup = idêntico).
BACKUP: `_design-reference/_backups/mockup-command-box-vista-piloto.BACKUP-recalibracao-2026-06-16.html`.

ITEM 1 — RECALIBRAÇÃO (feita e provada):
- `tools/recalibrar-mapa-command-box.mjs` — acha a transformação de semelhança (escala+rotação+posição+espelho) desenho-oficial(823×799) → traço do Command Box (viewBox 130 110 580 660), testando todas as rotações/direções/espelho. Reusa a amarração provada GPS→desenho-oficial (pista-oficial-brasilia.js).
- Saída: `web/cockpit/pista-brasilia-commandbox.js` (função `geoParaCommandBox(lat,lng)`).
- VALIDADO com volta REAL do Bubi (gps-23-05.tsv, 1013 leituras, independente do ajuste): mediana 7,3 px (0,33 largura de pista), p95 22,9 px (~1 largura), máx 53,8 px (~2,4 larguras, 1-2 curvas onde o desenho estilizado abre). Sobreposição de caixas 100%, centros a 15 px.

ITEM 2 — SUAVIZAÇÃO (feita, testada, demonstrada):
- Verificado: GPS real é ~1 leitura/seg (mediana 1000 ms; buraco máx 9,2 s) → ~28 m/leitura a 100 km/h. Suavização necessária confirmada.
- `web/cockpit/suavizador-bolinha.js` — desliza pela FRAÇÃO DE ARCO do traço (sempre na pista), trata virada de volta e NÃO inventa trajeto em perda de sinal (marca perdido).
- `tests/node-smoke-suavizador-bolinha.mjs` — 10/10 verdes.

PROVA VISUAL (aberta no navegador): `relatorios/prova-bolinha-command-box.html` — pista do CB + volta real por cima + 2 bolinhas (crua pulando 1/seg vs suavizada deslizando 60 q/s), trecho limpo de ~95 s tocado em 14 s.

PENDENTE (NÃO feito de propósito — é item 3 + decisão do Flávio): ligar de verdade no mockup (trocar o relógio fictício liveT pela fração derivada do GPS ao vivo) e DECISÃO A vs B (quem projeta: notebook ou Command Box).

TASK_DONE:
- Pedido conferido: sim (item 1 depois item 2)
- Ambiente: desenvolvimento | Produção alterada: não | Mockup alterado: não
- Arquivos inspecionados/criados: sim (6 novos; mockup preservado, backup feito)
- Validação executada: sim (volta real projetada + 10 testes do suavizador + prova visual no navegador)
- Resultado: concluído (itens 1 e 2). Item 3 (ligar ao vivo no mockup) aguarda decisão A vs B.
- Pendências reais: decisão A vs B (quem projeta o GPS) antes de fundir no mockup ao vivo.
