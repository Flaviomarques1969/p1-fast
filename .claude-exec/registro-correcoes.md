# Registro de correções — P1 Fast

Formato: data · CATEGORIA · arquivo/sintoma · o que era · correção · teste/prova. Consultar ANTES de editar.

## 2026-07-11 · CÓDIGO · project.yml/Info.plist (integração Home) · cockpit abria certo e DEPOIS entortava (dupla rotação)
Sintoma: Flávio — "a tela aparece certa, aí entra aquela anterior na posição errada".
Causa: a base de ontem liberou Landscape nativo no project.yml/Info.plist; a oficial trava o app em PÉ e gira o
cockpit na mão. Com os dois, o iOS girava a janela DEPOIS do overlay já girado → dupla rotação com atraso.
Correção: project.yml + Info.plist restaurados da oficial (só Portrait; grep Landscape = 0 no plist gerado);
reempacotado e reinstalado. Prova: BUILD SUCCEEDED + app relançado; confirmação visual do Flávio pendente.
Lição: a arquitetura de rotação tem 4ª peça — a PERMISSÃO de orientação (project.yml/Info.plist); no merge ela
também tem que vir do mesmo lado que gate+apresentação+tela.

## 2026-07-11 · CÓDIGO · ContentView (integração Home) · cockpit desenhou EM PÉ na tela deitada (posição errada)
Sintoma: foto do Flávio — painel do cockpit girado 90° dentro da paisagem.
Causa: o merge misturou DUAS arquiteturas de rotação: ficou o ContentView da base (virada nativa, cockpit sem
ângulo) com o OrientationGate/CockpitPilotoView oficiais (overlay que RECEBE o ângulo do giro). Metade de cada = tela deitada errada.
Correção: transplantado o bloco de apresentação OFICIAL inteiro no ContentView (overlay sempre montado,
opacidade pelo ângulo, tela cheia, launch args de teste). Prova: BUILD SUCCEEDED + reinstalado no iPhone;
confirmação visual do Flávio pendente (NÃO VERIFICADO por foto minha — aparelho físico).
Lição: rotação é ARQUITETURA em 3 peças (gate + apresentação + tela) — no merge, as 3 têm que vir do MESMO lado.

## 2026-07-11 · CONDUTA · integração da Home partiu de base VELHA (68813c12) e regrediu o cockpit no iPhone (2ª rodada do conserto)
Sintoma: mesmo após repor cockpit-app.html, Flávio reportou o cockpit "todo bagunçado" — faltava o ecossistema
inteiro de hoje (coach-card/miolo/zoom, régua de rotação 45°/29° do Flávio, Assistir com reconexão silenciosa).
Causa: 68813c12 ("main local" de ontem 18h11) NÃO era ancestral da linha oficial de hoje — eram linhas IRMÃS;
repor 1 arquivo não repõe a família. Correção: merge da linha oficial (8cf295e0) na integração; conflitos
resolvidos com "oficial vence no produto" + rotação 100% oficial (AppDelegate da base descartado) + Assistir
mesclado em 3 vias (reconexão oficial + modo demonstração preservado); diários unificados por união de blocos.
Prova: BUILD SUCCEEDED no aparelho físico; app reinstalado/relançado; validação visual do Flávio pendente.
Lição: base de orquestração = SEMPRE a ponta da linha oficial ATUAL no dia (conferir git log do worktree principal
antes do dispatch), e "recuperar tela" = recuperar a FAMÍLIA de arquivos, não o arquivo solto.

## 2026-07-11 · CONDUTA · instalação da Home nova regrediu a tela do cockpit do piloto no iPhone
Sintoma: Flávio notou que o aparelho perdeu a última versão do cockpit (corrigida hoje 12h08, aprovada "perfeito").
Causa: as linhas da Home partiram do ponto 68813c12 (ontem 18h11), ANTERIOR à correção do cockpit (c9cdb82a, hoje
12h08); instalar o app inteiro a partir dessa base sobrescreveu o cockpit no aparelho com a versão velha. NADA se
perdeu no computador — a versão certa estava na pasta oficial.
Correção: cockpit-app.html + CockpitPilotoView.swift recuperados de c9cdb82a na linha de integração; reempacotado e
reinstalado. Prova: md5 fe3558dd (versão de hoje) conferido DENTRO do pacote instalado; app relançado no aparelho.
Lição: antes de instalar app inteiro no aparelho a partir de linha antiga, comparar a base com a versão oficial
ATUAL (arquivos aprovados hoje podem ser mais novos que a base) — instalar app é operação de APARELHO inteiro,
não só da tela nova.

## 2026-07-11 · CÓDIGO · instalação no iPhone (home-integracao) · app subiu SEM as chaves do servidor ("servidor não está configurado")
Sintoma: app instalado do ambiente de integração acusou servidor não configurado na tela.
Causa: `Config/.env.xcconfig` (chaves Supabase) NÃO é versionado — ambiente isolado novo nasce sem ele; o
empacotamento passa mesmo assim (a J2 já tinha documentado esse passo e a integração não o repetiu p/ aparelho).
Correção: copiado o .env.xcconfig da pasta oficial pro ambiente de integração; reempacotado e reinstalado no
iPhone 16 Pro Max. Prova: BUILD SUCCEEDED + app relançado no aparelho; confirmação visual do Flávio pendente.
Lição: TODA instalação a partir de ambiente isolado começa conferindo `Config/.env.xcconfig` presente.

## 2026-07-11 · CONDUTA · entrega J5 Home Dia de Pista · fiação do ContentView pronta mas FORA do registro (REINCIDÊNCIA do padrão da J2)
Sintoma: relatório da J5 declarava ContentView +31 no delta; a linha não tinha o arquivo — estava só preparado, sem registrar.
Causa: janela fechou a entrega sem conferir `git status` (mesmo erro da J2 no mesmo dia).
Correção: coordenador auditou o conteúdo (prontidão SOMENTE LEITURA, nil honesto) e registrou na linha da J5.
Prova: `git log` da linha mostra o registro; diff conferido linha a linha antes.
Lição: instrução pros próximos mandatos: "entrega só fecha com `git status` LIMPO e conferido" — 2ª ocorrência no mesmo dia.

## 2026-07-11 · CONDUTA · entrega J4 Garagem · cache de empacotamento (build-sim, ~7.200 arquivos) registrado na linha por auto-save
Sintoma: diff da linha da J4 com 7.223 arquivos — quase tudo `ios/p1fast-ios/build-sim/` (cache do xcodebuild com -derivedDataPath dentro do repositório).
Causa: J4 apontou a pasta de empacotamento pra dentro do projeto e o auto-save registrou o lixo junto.
Correção: coordenador tirou a pasta do registro (git rm --cached) e acrescentou `build-sim/` ao .gitignore na linha da J4;
trabalho real preservado (GaragemView + HubMockLauncher + fotos). Prova: diff da linha caiu de 7.223 para 9 arquivos.
Lição: -derivedDataPath NUNCA dentro do repositório (usar /tmp); auditoria confere o TAMANHO do diff antes de aprovar.

## 2026-07-11 · CÓDIGO · ios/p1fast-core/Package.resolved (J4 Home "Dia de Pista") · xcodegen/xcodebuild mexeu no arquivo tracked (ADR-022)
Sintoma: após `xcodegen generate` + `xcodebuild` no worktree, `git diff --stat main` acusou `Package.resolved` com 72 deleções.
Causa: a geração/resolução SPM reescreve o `Package.resolved` (é a armadilha recorrente já em memória global). ADR-022: é tracked, não deletar/zerar.
Correção: `git checkout main -- ios/p1fast-core/Package.resolved`. Prova: `git diff --stat main -- ...Package.resolved` vazio (bate com main). Lição: depois de gerar/empacotar iOS, conferir se o Package.resolved foi mexido e restaurar de main ANTES de entregar.

## 2026-07-11 · CÓDIGO · GaragemView.swift ScrollViewReader (J4) · `.id()` no `Group` não dá alvo pro scrollTo
Sintoma: prova por foto rolava só até o eyebrow da seção; as 2 linhas ficavam fora da tela.
Causa: a seção era um `Group` (2 filhos irmãos no VStack pai) — `.id()` no Group não tem frame único, então `proxy.scrollTo(anchor:.bottom)` ancorava errado.
Correção: seção virou `VStack` (um só frame) com o `.id`; scroll instantâneo (sem `withAnimation`) + delay 0.6s. Prova: foto `1-garagem-secao.png` mostra a seção inteira. Lição: alvo de `scrollTo` precisa ser uma view com frame concreto, não um `Group`.

## 2026-07-11 · CONDUTA · entrega J2 Home Dia de Pista · componente pronto mas FORA do registro da linha de trabalho
Sintoma: relatório da J2 dizia 2 componentes; o registro da linha só tinha MelhorVoltaCard — AoVivoRow.swift
estava solto (untracked) no ambiente isolado e se perderia numa limpeza.
Causa: J2 registrou só o 1º arquivo e fechou a entrega sem conferir `git status`.
Correção: coordenador conferiu o status na auditoria, registrou o arquivo (a6556b0d) e validou conteúdo (sem emoji,
sem vermelho, assinatura do contrato). Prova: `git log` mostra o arquivo na linha; fotos dos 3 estados conferidas.
Lição: auditoria de entrega SEMPRE confere o `git status` do ambiente da janela — relatório não é prova de registro.

## 2026-07-11 · CÓDIGO · cockpit-app.html (app iOS) · montador transplantou o ESTILO de adaptação mas esqueceu o REDIMENSIONADOR
Sintoma: no iPhone real a tela saiu do padrão (painel sem escala, cortado à direita, descentrado — foto do Flávio).
Causa: a cópia antiga tinha DUAS peças de adaptação — o <style> (topo oculto, palco fixo) E um <script> no rodapé
que escala o #device pra caber na tela (fit por proporção). Meu montador levou só o estilo.
Correção: redimensionador recuperado do histórico (d60e3bbd) e transplantado antes do </body>; reempacotado e
reinstalado. Prova: render 932×430 (proporção do iPhone) com painel inteiro, escalado e centrado (foto); app
relançado no aparelho via linha de comando com sucesso.
Lição: adaptação de tela costuma ser estilo + script em PARES — ao transplantar, procurar as DUAS metades
(grep pelos comentários/âncoras no arquivo antigo inteiro, não só no <head>).

## 2026-07-10 · CÓDIGO · coach-zoom-live.js · fatia deslizante chamou função removida na reescrita (idxMaisPerto)
Sintoma: mapa nasceu VAZIO nas fotos (md5 idêntico entre poses = nenhum evento pintou); console: ReferenceError
idxMaisPerto — a v2.1 removeu a função antiga e a fatia nova ainda a chamava. Import em node passou (sintaxe ok)
porque o erro é de EXECUÇÃO. Correção: função própria idxPistaMaisPerto + chamada trocada. Prova: cena voltou
(foto), fatia troca quando o carro viaja (path mudou em teste sintético). Lição: checagem de sintaxe não pega
referência morta — SEMPRE renderizar e olhar depois de reescrever módulo. (Nota: ?pose=N ignora o N — andaime
antigo congela sempre na 1ª entrada de curva; t da pista é epoch. Não corrigido — comportamento aprovado.)

## 2026-07-10 · CÓDIGO · miolo v2 · 3 defeitos graves achados pela AUDITORIA EXTERNA (pedida pelo Flávio) e corrigidos
Sintomas: (1) coach-miolo.css MORTO na cascata — o `<link>` vinha ANTES do `<style>` interno do painel, que redeclara
os mesmos seletores → freada 180px desenhava POR CIMA do vidro; (2) `lerpAng` com wrap quebrado + transform em `matrix()`
interpolada → chicotada de ~100° no mapa 1×/volta a partir da 2ª; (3) portais do fixture ANTIGO ≠ portais do painel
(40/60 m) → bolinha do ghost nascia 30-340 m atrás e o acumulado tinha viés de −20/−30 s por volta (verde eterno = mentira).
Correções: link movido para DEPOIS do estilo interno; wrap normalizado + transform por funções explícitas
(translate/rotate/scale); âncora ESPACIAL do relógio do ghost (ponto mais próximo na entrada) + portão de ~40 m
(sem cobertura → ghost se esconde) + acumulado só com os dois portais projetados interiores e próximos.
Prova: medidas reais pós-fix (delta fim=321 < vidro 347; freada 820→925 < bolinhas 936; fonte 118px valendo);
teste sintético de 2 voltas em círculo = 0 saltos de giro >90°; foto renderizada confere o heading-up.
Lição: (a) `<link>` só vence se vier DEPOIS do `<style>` interno; (b) nunca animar rotação por matrix() interpolada;
(c) dado com portais diferentes não se compara sem projetar nos MESMOS portais.

## 2026-07-10 · CÓDIGO · coach-zoom-live.js (miolo v2) · PONTOS_DESENHO é lista de PARES [x,y], não objetos {x,y}
Sintoma: zoom central nascia vazio (0 camadas); console: TypeError toFixed em pol()→armarCena — assumi que
PONTOS_DESENHO (pista-oficial-brasilia.js:29) tinha objetos {x,y} como o retorno de geoParaDesenho. Real: pares [x,y].
Correção: normalização única na entrada (`const PISTA = PONTOS_DESENHO.map(...)`) e usos trocados para PISTA.
Prova: recarga ?pose=30 → svg com 5 camadas, ghost tracejado, rótulo "CURVA 2 · GHOST"; foto em Chrome descartável
confirma o desenho. Lição: um módulo pode exportar DOIS formatos de ponto — conferir o shape LITERAL do export
antes de consumir (comentário/spec do vizinho não é prova).

## 2026-07-10 · CÓDIGO · CONSTRUTORA TELA M2 · render do coach precisou casar com o formato REAL do pacote (não o do andaime)
Sintoma: ao trocar o ANDAIME pelo pacote REAL do CÉREBRO (`construcao/pacote-exemplo.json`), 3 detalhes do meu render (feitos p/ o andaime) não batiam:
(1) a linha de ação real vem com ESPAÇOS (`"carregue mais   1,0 s"`), meu split era só por tabulação → o ganho não separava;
(2) o `viewBox` real vem CRU (bbox+margem, ~8:1 no "S"), meu encaixe ao slot estava no GERADOR do andaime, não na tela → recorte real ficaria letterbox fino;
(3) o pacote real não manda `velocidadeNaLinha`/`destaqueSubFracao` → velocidade sumia e a banda do sub não desenhava.
Correção (só no `coach-card.js`, TELA — o dado é fonte única, não toquei): `separarAcao()` robusto (tab OU 2+ espaços OU ganho no fim); `ajustarViewBoxAoSlot()` movido p/ a tela (expande simétrico até 394/238, sem distorcer); velocidade = padrão da tela e banda com fração default 0,3–0,7. Linha do silêncio renderizada COMO VEM (`coach.linha.texto`) — nada hardcoded.
Prova (navegador, pose=30 + DOM): verbo="carregue mais" / ganho="1,0 s"; viewBox final 1,66:1; oportunidade cede números (opacity 0), silêncio não (opacity 1); só âmbar. Smokes cockpit + arquitetura verdes; `cockpit.css` 0 mudanças. Bloco M2 na caixa do Fable.
Lição: render feito contra o ANDAIME precisa ser reconferido contra o formato REAL do pacote (separador de texto, viewBox cru, flags ausentes) — o que casa no mock pode não casar no dado do cérebro.

## 2026-07-10 · CÓDIGO · cerebro-coach-stint.js · linha do silêncio sem a contagem de voltas (nota cosmética do Fable no M2)
Sintoma: no ramo 'silencio' coletando-dados, a linha pré-computada saía "Juntando dado" — a tabela J1 §2.5 prevê
"Juntando dado — 2 voltas" (com a contagem, que status.voltasObservadas já carrega). Também o N1 saía "\"S\"" em vez
de "Curva \"S\"" (nomeCurto agressivo demais).
Correção: linhaSilencio passou a receber o status e concatenar "— N volta(s)"; nomeCurto mantém "Curva" p/ numeradas
e a "S", encurta as nomeadas (Bruxa/Junção/…). Prova: node tests/node-smoke-coach-stint.mjs → 11 ok / 0 fail (CS-04
checa "Juntando dado — 2 voltas"; CS-01 N1 "Curva \"S\" · 1,0 s"); pacote-exemplo.json republicado.
Lição: texto pré-computado que a tabela da entrega especifica deve sair COMPLETO da origem (o dado já tem a contagem).

## 2026-07-10 · CÓDIGO · cerebro-coach-stint.js · p25 filtrava gap<=0,05 ANTES do quantil → Vitória bimodal elegia falso
Sintoma: no acumulador do coach, eu calculava o ganhoVoltaS (quantil p25) só sobre as voltas com gap>0,05.
A Vitória (bimodal: voltas [~0,005 · 1,008 · 1,009 · 0,004 · 1,003]) virava [1,003·1,008·1,009] → p25=1,003 →
elegia como oportunidade, quando o conservador (decisão 9, = J5 C4) manda silenciar (o piloto às vezes IGUALA a ref).
Correção: p25 passou a ser sobre TODAS as voltas voadoras com gap negativo/zero contando 0 (janela-2 §3.3/§3.5/§3.6);
o filtro de piso ficou só pra hitRate/recorrência. Vitória → p25≈0,005 < piso 0,10 → silêncio. Prova: teste CS-06 verde
(Vitória não elege) e CS-01 mantém Curva "S" 0,996 (5/5) — node tests/node-smoke-coach-stint.mjs → 11 ok / 0 fail.
Lição: quantil conservador é sobre a distribuição INTEIRA; filtrar os "bons" antes do quantil inverte o conservador.

## 2026-07-10 · CÓDIGO · cerebro-painel.js:167 · ligar o coach sem quebrar o comportamento atual
Sintoma/risco: ligar o campo `coach` (hoje `const coach = null`) podia quebrar chamadores que não têm o acumulador.
Correção: acumulador de stint é OPCIONAL via `opts.coachStint`; sem ele, `coach` continua null e em `_pendentes`
(idêntico a hoje) — adicionei também `onDeltaCoach` (no-op sem acumulador). v0 `cerebro-coach.js` INTOCADA (git diff vazio).
Prova: cerebro-painel.smoke.mjs → TUDO VERDE ("coach/preditivo ainda pendentes (honesto)"); smoke:arquitetura 28/0.
Lição: ligar campo novo num módulo compartilhado = dependência OPCIONAL com default = comportamento atual; nunca obrigatória.

## 2026-07-10 · CÓDIGO · PASSO 0 do Coach — freada FORA do segmento é do PRODUTO (linhas vivas 0029), não só do fixture
Sintoma: a J5 achou "freada fora do trecho em 4/8 curvas" medindo no fixture `passagens-bubi-brasilia.v1.json` e deixou aberto
se era só do fixture ou do produto. Investiguei (Construtora CÉREBRO, passo 0): (B) rodei o `TrechoDetector` REAL com as linhas
VIVAS (migration 0029 v2, janela apex±30m) sobre o traço cru `volta-real-gps-23-05-rodando.json` 1Hz → a freada cai FORA do
segmento nas curvas rápidas (`freada-iniciou` nunca dispara em Curva01/Junção/Placar/Vitória; Curva 2 freou 68km/h ANTES da
entrada e 0 DEPOIS). (A) o fixture usa segmentação ANTIGA (5/8 passagens a 60-220m do ápice 0029; tempo_trecho 8-21s ≫ 60m),
só rotulada com os IDs canônicos. Veredito: MISTO com componente de registro no PRODUTO → portão do passo 0 acionado, PAREI.
Correção: NÃO alterei nada (produção/produto protegidos); laudo + provas em `coach-ia-sala/construcao/passo0/`, bloco M1 na
caixa do Fable, decisão escalada (recomendo seguir os passos 1-3 no caminho honesto `subTrecho:null`). Sistema não quebra.
Prova (real): `RESULTADO-passo0-detector-linhas-vivas.txt` + `RESULTADO-passo0-fixture-vs-0029.txt` (2026-07-10T13:40Z).
Lição: "achado medido no fixture" ≠ "defeito do fixture" — rodar o detector real com as linhas VIVAS sobre o traço cru
separa produto de dado de teste; e ID de segmento igual ≠ mesma geometria (o fixture reusa IDs de segmentação antiga).

## 2026-07-10 · CÓDIGO · validação no navegador: replay com requestAnimationFrame CONGELA em aba de 2º plano (parecia "não roda")
Sintoma (CONSTRUTORA TELA, M1): abri `cockpit-volta-real.html` ao vivo via automação do Chrome e o replay não avançava (tempo 00:00,
hVel 0, 0 eventos de curva) — quase concluí "o replay quebrou / meu driver não engatou". Real: `document.visibilityState==='hidden'` na
aba automatizada → o Chrome congela o `requestAnimationFrame`, então o loop `frame()` não roda (o `?pose=` funciona porque é SÍNCRONO, sem rAF).
Correção: validei os estados no modo `?pose=SEG` (render síncrono) e a lógica ao vivo disparando os eventos reais do portão
(`device.dispatchEvent('coach:volta-fim'|'coach:curva')`) + conferindo `data-coach`/opacity por `getComputedStyle`; a captura final pegou o
replay já rodando e provou os números cedendo/voltando. Prova: screenshots dos 6 estados + crítico; `data-coach` oculto→oportunidade→oculto.
Lição: "tempo 00:00 / rAF parado" em aba automatizada ≠ "código quebrado" — checar `visibilityState` antes; validar por `?pose=` + disparo de eventos.

## 2026-07-08 · CÓDIGO · entrega J2 (janela-2.md) · confiança ambígua + fallback que nunca pontuava (QA da J5, CORRIGIR do Fable)
Sintoma: (F2) os 2 exemplos do §4.3 usavam janelas de contagem DIFERENTES pro fAmostras (um contava amostras agregadas do
stint, outro por volta) → ou a manchete "S" nunca elegia, ou o Placar elegia. (F3a) o fallback de curva inteira (§5.4)
usava fAmostras de um SUB (≈0 em curva curta) → score = ganho×0 → nunca elegia (curvas curtas ficavam órfãs, o oposto do fim dele).
Correção: F2 — fixei a janela em AGREGADA no stint e reescrevi os 2 exemplos na mesma régua. F3a — régua própria pro fallback
(fAmostras sobre os pontos da CURVA inteira). F3b — deixei os 2 ramos (p25×mediana) especificados + decisão pro Flávio.
F8 — marquei [fixture]/[ilustrativo]. F1 — §7.2 novo (investigação de limites de segmento com a J4).
Prova (fixture, node): pontos agregados/voadoras por curva — "S"=37, Placar=23, Vitória=28, Curva 2=96; Placar ~0,9 pt/sub/volta
(por isso não elege no sub). Método central inalterado — J5 reproduziu out-laps 76/77 s e "S" quantil-baixo 0,996 s. 2º PRONTO no canal.
Lição: fórmula com "amostras" precisa dizer QUAL janela conta (volta vs stint); e todo gate multiplicativo (×0) tem que ter régua que não zere quem ele deveria salvar.

## 2026-07-08 · CONDUTA · `grep --include="*.js"` falhou silencioso no zsh e quase descartei arquivo REAL
Sintoma: rodei `grep -rInE "..." --include=*.js` (sem aspas) no zsh e veio "(eval): no matches found: --include=*.js" — o comando
nem buscou. Ia registrar `web/.../oportunidade-trecho.js` como "inexistente / alucinação do subagente".
Real: o arquivo EXISTE em `web/cockpit/oportunidade-trecho.js` (v3 aprovado Flávio 09/06). A busca é que quebrou, não o arquivo.
Correção: reexecutei com `--include="*.js"` entre aspas; achei o arquivo e conferi o conteúdo ANTES de citar (§6.3 da entrega J2).
Prova: `grep -rIn --include="*.js" "vminDosPontos|FECHA A CURVA|JANELA_PASSAGENS" .` retornou `web/cockpit/oportunidade-trecho.js`.
Lição: no zsh, glob de `--include` precisa de aspas; e "grep não achou" ≠ "não existe" — confirmar existência antes de afirmar ausência.

## 2026-07-08 · CÓDIGO · briefing do Coach de IA afirmava encaixe "vazio" — mas cerebro-coach.js tem v0 funcional
Sintoma: `.claude-exec/PROMPT-FABLE5-COACH-IA-STINT.md` §4.3 diz que `web/command-box/cerebro/cerebro-coach.js`
"devolve null / nunca montada". Real: o arquivo contém v0 funcional (`avaliarCoach`, seleção por km/h pro
Command Box); o que é null é o CAMPO `coach` em `cerebro-painel.js:167` (o cérebro nunca chama o módulo).
Risco: uma das 5 janelas do Coach de IA sobrescrever/apagar a v0 achando o arquivo vazio.
Correção: travado em `coach-ia-sala/PLANO-MESTRE.md` §2.5 + mandatos nas caixas (J4: preservar v0 e propor
convivência; J5: fiscalizar). Prova: `cat cerebro-coach.js` (v0 inteira) + `grep -n coach cerebro-painel.js`
(l.167 `const coach = null;`) em 2026-07-08. Lição: briefing datado não substitui conferência no código.

## 2026-07-05 · CONDUTA · incorporei versão INCOMPLETA na linha ativa (produção) — item 4 iria quebrado
Sintoma: na ida ao ar da Fase 2, empurrei minha branch LOCAL (`04bc72aa`, só com o revert do harness) pra
`sync/notebook-dia-de-pista-2026-06-23`, SEM os 3 commits de leitura da nuvem que o notebook já tinha
enviado em `origin/claude/fase2-ia-temperatura` (a683e1cb/6b1eb349/3e672de7). `MainWindow.LimitesCarro.cs`
ficou AUSENTE → o "ajuste por carro" cairia sempre no Default (item 4 morto silenciosamente). O notebook
pegou ANTES de rodar. Correção: cherry-pick dos 3 commits em cima de 04bc72aa → push avanço direto
`04bc72aa → 2a9788c8`; conferi `git cat-file -e origin/sync:...LimitesCarro.cs` = PRESENTE; domínio 411/411.
Lição: antes de empurrar pra produção, comparar a branch LOCAL com `origin/<branch>` (a linha pode ter
avançado pelo outro lado); conferir os ARQUIVOS-CHAVE presentes no destino, não só "fast-forward ok".

## 2026-07-05 · CONDUTA · harness temporário de preview foi parar num commit (auto-save)
Sintoma: pra fotografar a tela "Alertas" no simulador, modifiquei TEMPORARIAMENTE o entry point
(P1FastApp.swift) e o .task da SetupAvancadoView. O auto-save da IDE COMMITOU o harness sem eu pedir.
Correção: restaurei os 2 arquivos do backup + `git commit` de reversão; conferi `git show HEAD:...`
= 0 marcas de harness e a seção Alertas real intacta. Prova: harness no HEAD dos 2 arquivos = 0.
Lição: ao fazer harness/modificação temporária em projeto com auto-save, SEMPRE reverter E conferir
o HEAD (não só o working tree) antes de fechar — o auto-save pode ter versionado o temporário.

## 2026-07-05 · CÓDIGO · dotnet test dá "exit 0" mesmo sem rodar os testes
Sintoma: `dotnet test` do domínio retornou exit 0, mas NÃO rodou os testes — abortou com "You must install
or update .NET to run this application" (testhost é net8.0; neste iMac só há runtime .NET 10).
Correção: rodar com `DOTNET_ROLL_FORWARD=Major dotnet test ...` (roll-forward do net8 pro runtime 10). NÃO
alterei o .csproj (é compartilhado com o notebook). Prova: passou de "Anulada" pra 396/396 aprovados.
Lição: nunca confiar só no exit code do `dotnet test` — conferir a linha "Aprovado/Com falha" na saída.

## 2026-07-05 · CÓDIGO · AprendizadoTemperatura.cs · salto no padrão após pausa longa
Sintoma (achado na auto-auditoria): intervalo grande entre amostras (box, religada, buraco na captura) fazia
`dt` gigante → aprendizado dava um salto e podia erodir a máxima normal com temperatura de box frio →
alarme falso na volta seguinte. Correção: teto `DtMaxS=5s` no dt do aprendizado (configurável). Prova:
396/396 verdes (ATP_06 reescrito pra amostras reais em vez do atalho dt=300).

## 2026-07-08 · CONDUTA · Janela 1 quase trabalhou contra o objeto v0 provisório em vez do v1 REAL da J2
Sintoma: primeiro `ls -la entregas/` veio vazio; conclui que a J2 não tinha entregue e ia escrever a mensagem
contra o v0 provisório do Fable (PLANO-MESTRE §2.1) — que é menos rico que o objeto real.
Real: `entregas/janela-2.md` (objeto v1) e `janela-4.md` JÁ existiam; o `ls` inicial estava defasado. Só descobri
ao cruzar com `ultima-tarefa.md` (que citava entregas de J2/J4) e reconferir com `git status` + `find`.
Correção: li `entregas/janela-2.md §1` e escrevi a mensagem contra o objeto REAL v1 (subTrecho:null, tipoCurva,
apice, status, confianca), não o v0. Prova: `find . -name "janela-2.md"` achou o arquivo; entrega J1 cita campos v1.
Lição: entrega vazia num `ls` ≠ "não entregou" — cruzar com registro/git/find antes de assumir e antes de produzir contra formato provisório.

## 2026-07-08 · CÓDIGO · ápice-semente NÃO casa com as passagens do fixture (7/8 curvas) — ancorar o gráfico no traço
Sintoma (Janela 3): ia usar `apices-semente-brasilia.js` como âncora da bolinha/zoom do gráfico do coach.
Real: rodei `geoParaDesenho` no ápice-semente e no meio das passagens do fixture por curva — divergem 53–164 px
(BRUXA 95px, PLACAR 164px; só CURVA 2 bate, 7px). Mesmo conversor nos dois → registros diferentes (ou rótulo de curva).
Correção: gráfico ancora no `oportunidade.tracos` + `oportunidade.apice` (trecho-detector, objeto v1 da J2), NÃO no semente
(que o próprio arquivo diz "sai de cena quando a melhor passagem calcular o ápice físico"). Sinalizado à J2/J4 (janela-3.md §5).
Prova: `scratchpad/prova-zoom.mjs` (bbox/viewBox reais da Bruxa) + `scratchpad/prova2.mjs` (tabela de divergência por curva), 2026-07-08.
Lição: dois arquivos "da mesma pista" não estão no mesmo registro por default — cruzar geometria antes de usar como âncora.

## 2026-07-08 · CONDUTA · Janela 4 formalizou o pacote contra o v0 do PLANO-MESTRE em vez do v1 REAL da J2
Sintoma: entrega janela-4.md (1ª passada, 19:34Z) montou o pacote coach sobre §2.3/§2.1 do PLANO-MESTRE (v0 provisório),
sem o objeto-companheiro `status` nem o `tempoAtualS` — quando `entregas/janela-2.md` (v1) já estava publicado (19:10Z).
Real: o Fable pegou na auditoria (SEGUIR + item 1) e mandou absorver o v1. Mesmo erro que o registro já avisava (J1).
Correção: li `entregas/janela-2.md §1`, dei casa ao `status` num envelope `coach` discriminado por `tipo` (§2) e coloquei
`tempoAtualS` aditivo como passo 1 da Fase 1 (§5). Prova no código: DeltaResultado C# tem TempoAtualS (DeltaCoach.cs:31);
calcularDelta JS não (delta-calculator.js:168-174). 2º bloco PRONTO no canal (20:01Z).
Lição: ANTES de formalizar contrato entre janelas, ler as `entregas/janela-*.md` publicadas — nunca só o v0 do PLANO-MESTRE.

## 2026-07-08 · CONDUTA · Janela 4 (2ª rodada) — faltou absorver as formas de J1/J3 já publicadas
Sintoma: 2ª passada absorveu só o v1 da J2; blocos do Fable 19:48Z+/20:08Z (formas da J1: mensagem pré-computada +
timing.nivel/podeMostrar; e GraficoSpec v1 da J3) só foram vistos depois, na leitura completa da caixa.
Causa: reagi ao veredito antes de reler a caixa inteira de cima a baixo (havia blocos novos empilhados).
Correção: reli do-fable.md inteiro; absorvi mensagem pré-computada (nota de serialização: só strings viajam, não a
função render), timing.nivel/podeMostrar, GraficoSpec v1 + porte geoParaDesenho (Fase 2), e a reconciliação do silêncio
(dado=coach.status J2 / texto=tabela J1 §2.5). Prova: entrega §2 reescrita; pista tempoAtualS conferida (mensagens-pedagogicas.js:206).
Lição: ao receber "aplique TODOS os blocos", ler a caixa inteira ANTES de editar — não parar no primeiro veredito.

## 2026-07-08 · CÓDIGO · correção ao registro: divergência ápice-semente é 4/8 (não 7/8) — método da medição importava
Sintoma (Janela 5, QA do Fable): a entrada de 2026-07-08 acima ("7/8 curvas divergem 53-164 px") superestimava.
Real: medindo a distância MÍNIMA do semente a QUALQUER ponto das passagens da curva (em metros, fórmula do produto),
divergem 4/8: BRUXA 70,4 m · PLACAR 235,0 m · "S" 99,9 m · VITÓRIA 82,4 m. CASAM: CURVA 01 3,2 m · RETA OPOSTA 2,5 m ·
JUNÇÃO 5,2 m · CURVA 2 4,0 m (promessa do próprio arquivo: ≤~10 m). O método anterior comparava com o ponto-do-MEIO
da passagem — mede "ápice no meio do segmento?", não "ápice na linha?". A decisão prática (ancorar gráfico em tracos/apice,
não no semente) fica DE PÉ. Prova: coach-ia-sala/provas-j5/analise-j5.mjs (§3) + RESULTADO-analise-j5.txt, 2026-07-08.
Lição: "distância ao ponto-do-meio" ≠ "distância à linha" — medir contra a linha toda antes de declarar divergência.

## 2026-07-08 · CÓDIGO · fixture: em 4/8 curvas a FREADA não está dentro do próprio segmento (achado F1 da J5)
Sintoma: cenário "freada da Bruxa" (briefing e entregas J1/J3) não sai do dado — pontos da Bruxa começam a 116-119 km/h
SÓ ACELERANDO (vmin no índice 0); Vitória idem (88→101); Reta Oposta e Junção TERMINAM no ponto lento; Placar sem ponto lento.
Consequência: sub 'freio' inatribuível nessas curvas com este registro (a freada da Bruxa mora no fim do segmento da Junção).
Rodado o motor real (calcularDelta) na Bruxa: gap relógio 0,485 s, integração 0,025 s (5%) → caminho comum = subTrecho:null.
NÃO VERIFICADO se as linhas ao vivo do trecho-detector têm o mesmo registro do fixture — investigação despachada a J2/J4 via Fable.
Prova: coach-ia-sala/provas-j5/prova-motor-bruxa.mjs + RESULTADO-*.txt + tabela de perfis em entregas/janela-5.md §3.

## 2026-07-08 · CONDUTA · Janela 1: exemplos usavam número/sub não derivados do fixture sem marcar como ilustrativos
Sintoma: QA da J5 (F8) apontou que os números dos Exemplos B/C/D (0,18/0,14/0,30) e o `subTrecho:'pace'` do Exemplo A
não saem do fixture, e o Exemplo A afirmava "saída" quando a 1 Hz o honesto é `subTrecho:null` (curva inteira).
Erro: apresentar número ilustrativo com aparência de medição; e apontar sub-trecho fino que o dado de 1 Hz não sustenta.
Correção: marquei B/C/D como FORMATO ILUSTRATIVO, corrigi o Exemplo A para `subTrecho:null` (mensagem de curva inteira),
apontei os cenários C1-C5 da J5 como os oficiais reproduzíveis, e escrevi o achado central (1 Hz → `null` é o dia a dia da Fase 1).
Verificação: conferido contra `entregas/janela-5.md` (C1 0,99 s; C2 Bruxa 0,485 s motor rodado; C4 SF; F8) — números da J5 saíram de script executado. Entrega J1 §4 atualizada.

## 2026-07-08 · CONDUTA/CÓDIGO · Janela 4 — plano de teste pressupunha pontos já anotados (QA da J5 pegou)
Sintoma: o plano de teste da Fase 1 pressupunha DeltaResultado já com fracao/sub, mas o fixture tem pontos crus
{lat,lng,kmh,t} e o anotador vivo (coletor+trecho-detector) não roda no replay — teste de paridade não fecharia.
Além disso: J5 achou que 4/8 curvas têm a freada FORA do trecho nomeado (limites tortos no fixture 23-24/05).
Correção: nomeei o anotador do teste (pontoCanonico p/ fracao + marcos do trecho-detector p/ sub; onde não cai no
segmento → subTrecho:null honesto) e criei PASSO 0 (conferir linhas do trecho-detector vs fixture antes de construir).
F6: Fase 1 passou a embarcar N1+N2. Prova: pontoCanonico existe (delta-calculator.js:188); trecho-detector.js existe; J5 §3.
Lição: plano de teste precisa nomear QUEM anota o dado cru — replay não herda o anotador vivo de graça.

---
### 2026-07-10 — [CONDUTA/OPERACAO] Semeadura autorizada de envelope plano_stint em PRODUCAO
Area: banco producao Supabase, tabela envelopes_seguranca_stint (Bubi 641a81e7...).
Tags: producao, plano_stint, canal claude-comms, notebook.
Situacao: notebook (Fable 5) pediu pelo canal um envelope de HOJE com plano_stint pra validar a barra contra banco real.
Acao: Flavio autorizou com "MIGRAR PARA PRODUCAO"; inseri 1 envelope espelhando o ultimo real, plano voltas=10/box na 4a. id c156a199-099a-4e69-878d-c3e027ca1bd4.
Verificacao: FEITA — consulta do app (created_at.desc limit 1) devolve o registro como row[0]; created_at 2026-07-10 (hoje SP) passa a trava de validade. Respondi o notebook pelo canal (commit 7ae75e54). Validacao final da barra na tela e com o notebook.

### 2026-07-11 — [CONDUTA/DECISAO] Registro de teste c156a199 mantido (Flavio escolheu deixar)
Area: banco producao, envelopes_seguranca_stint (Bubi).
Tags: producao, plano_stint, decisao-flavio, painel-perguntar.
Situacao: apos validar, notebook pediu remover o envelope de teste; DELETE com anon retornou 0 (policy bloqueia delete; sem service_role no projeto).
Acao: painel de decisao (p1fast-limpar-teste-1038) -> Flavio escolheu opcao A: DEIXAR. Registro auto-expira (aprovado 10/07 vs hoje 11/07 -> painel nao arma). Avisei notebook (commit no canal).
Verificacao: FEITA — simulacao da regra de validade (SP) prova que o painel nao arma o plano de ontem; consulta confirma que a linha nao afeta a tela do piloto.

### Historico decisao

## 2026-07-11 — CÓDIGO — cockpit-app.html (app iOS) — tela do cockpit deslocada/cortada no iPhone com Zoom da Tela
- **Tags:** app-ios, viewport, zoom-da-tela, wkwebview, redimensionador
- **Situação:** no iPhone real do Flávio o painel aparecia ~2× grande, deslocado com faixa azul-marinho e bordas cortadas; nos simuladores comuns ficava perfeito.
- **Erro:** a página declarava janela de largura FIXA `width=956` no meta viewport. Com o Zoom da Tela do iPhone ativado (tela lógica 375×812 → janela do painel 720×283), o WebKit cria uma folha interna de 956 e exibe só o canto superior esquerdo; o palco centrava o painel na folha grande → deslocado e cortado. Segundo defeito em cadeia: ao trocar para `device-width`, o palco flexível ESPREMEU o painel de 956 para 720 (flex-shrink), sumindo a coluna de sensores.
- **Causa:** meta viewport herdado da tela do notebook (956 fixo) + painel sem tamanho pinado contra encolhimento do palco flexível.
- **Correção:** (1) meta viewport → `width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover`; (2) `#device { flex:none; width:956px; height:440px; }` no bloco de adaptação — só o redimensionador (scale) ajusta ao aparelho.
- **Verificação:** CORRIGIDO COM PROVA — defeito reproduzido em simulador 375×812 (iPhone 11 Pro, iOS 26.4) criado só pra isso; instrumentação temporária estampou os números reais (aparelho: win 720×283, s=0,64); após correção, capturas nos DOIS simuladores (375×812 s=0,64 e 16 Pro Max s=0,79) mostram painel íntegro, centrado, nada cortado; versão limpa (sem depuração) revalidada e instalada no iPhone físico 16 Pro Max.
- **Lição:** tela embutida em app NUNCA declara largura fixa no viewport — sempre `device-width` + elemento de projeto pinado + scale. E: geometria de aparelho com Zoom da Tela (375×812) é reproduzível em simulador de iPhone 11 Pro — não depender de foto do Flávio pra iterar.
  - **Adendo 12h15:** ajuste fino pedido pelo Flávio ("explorar a tela toda"): folga simétrica do painel no app 46→18 pontos (`CockpitPilotoView.swift`, `cockpitFolga`). Painel ~20% maior no aparelho com Zoom da Tela e ~16% maior sem zoom. Validado com capturas nos 2 simuladores (375×812 e 16 Pro Max): nada cortado, quinas e ilha não invadem conteúdo útil. Instalado no iPhone físico.

## 2026-07-11 — CÓDIGO — AssistirView.swift — erro técnico cru na tela do espectador
- **Tags:** app-ios, assistir, video, mensagem-de-erro, padrao-visual
- **Situação:** sem transmissão, a tela ASSISTIR AO VIVO mostrava "FALHOU" vermelho + despejo técnico ("MediasoupManagerError(CreateSendTransportFailed...)").
- **Erro:** o texto do erro interno ia direto pra tela do usuário; vermelho usado pra estado não-crítico (fura o padrão: vermelho só crítico).
- **Causa:** o estado `.falhou` renderizava `error.localizedDescription` cru; selo colorido pelo estado da conexão, não pela existência de vídeo.
- **Correção:** aviso único e elegante "Sem transmissão no momento" (ícone de traço + frase calma) pra QUALQUER estado sem vídeo; selo neutro "SEM TRANSMISSÃO" (cinza), "AO VIVO" verde só com vídeo chegando; detalhe técnico vai pro log interno (os.Logger "P1ASSISTIR"); nova tentativa silenciosa a cada 20s — quando houver transmissão, o vídeo entra sozinho.
- **Verificação:** CORRIGIDO COM PROVA — captura no simulador 16 Pro Max (via novo atalho de bancada `--p1-login-dev` + `--p1-assistir`): aviso elegante no ar, zero texto técnico. Instalado no iPhone físico.

## 2026-07-11 — CÓDIGO — coach-zoom-live.js (2 cópias) — carrinho com esterço → bolinha verde limão
- **Tags:** cockpit, zoom-central, carrinho, ordem-flavio
- **Situação:** o carrinho do zoom central inclinava errado nas curvas (esterço por curvatura nunca ficou premium).
- **Correção (ordem do Flávio 11/07):** carrinho e todo o código de esterço REMOVIDOS; no lugar, bolinha verde limão fixa (oklch 88% 0.25 130, r=5 + halo) — simétrica, sem rotação, sem problema de inclinação. Rastro continua com a cor de desempenho (verde/âmbar); bolinha do ghost segue azul. Aplicado na linha oficial (web/cockpit) E na cópia embutida do app.
- **Verificação:** CORRIGIDO COM PROVA — render real do painel web (?pose=30, Chrome sem janela) + captura do app no simulador 375×812: bolinha limão + rastro âmbar + ghost azul, sem carrinho. Sintaxe validada por import Node. Instalado no iPhone físico.
- **Nota de bancada:** criado atalho DEV `--p1-login-dev` (só versão de desenvolvimento) que aperta sozinho o botão "Entrar como Flávio (dev)" — destrava validação automatizada de telas logadas no simulador.
  - **Adendo 13h25:** mesmo tratamento aplicado à tela de TESTE AO VIVO (espelhamento do notebook, `TesteAoVivoView.swift`): aviso "Sem transmissão no momento", selo neutro, erro técnico só no log interno (P1TESTEAOVIVO), retentativa silenciosa 20s. Prova: captura no simulador 16 Pro Max via `--p1-login-dev --p1-teste-aovivo`. Instalado no iPhone físico.
  - **Adendo 13h40 (OrientationGate.swift):** régua do giro ajustada por ordem do Flávio — o cockpit ativa ao cruzar 50% do giro (45°, antes 58°=64%) e desativa voltando abaixo de ~32% (29°, antes 42°); janela superior espelhada (135°/151°). Empacotamento OK e instalado no iPhone físico. Comportamento físico do giro: NÃO VERIFICADO por mim (exige girar o aparelho na mão) — aguardando teste do Flávio.
  - **Adendo 13h55 (OrientationGate.swift):** ordem do Flávio — cockpit só ativa em giro LATERAL (esquerda/direita). Causa do disparo "para a frente": ao deitar o aparelho (tela pro teto), a gravidade sai do plano da tela e o ângulo vira ruído, que parecia giro lateral. Trava: se a componente no plano da tela cai abaixo de 0,5 (aparelho mais de ~60° deitado), o estado CONGELA (nem abre, nem fecha); a régua de 50% do giro (45°/29°) segue valendo dentro do plano. Empacotado e instalado no iPhone físico. Giro físico: NÃO VERIFICADO por mim (exige o aparelho na mão) — aguardando teste do Flávio.

## 2026-07-11 · CÓDIGO · HeroEventoCard.swift (J1 Home Dia de Pista) · `.background(View)` não conforma ShapeStyle
Sintoma: `.background(fundoHero)` com uma View → erro "Type ... cannot conform to 'ShapeStyle' / Generic parameter 'S'
could not be inferred". No SwiftUI moderno `.background(_:)` de 1 argumento espera ShapeStyle; View vai em
`.background { ... }` (closure) ou `.background(alignment:content:)`. Correção: trocado para `.background { fundoHero }`.
Prova: xcodebuild alvo p1fast-ios no simulador P1-Zoom375 = BUILD SUCCEEDED (com os 4 #Preview) + 2 fotos dos 4 estados.
Lição: para as janelas SwiftUI — passar View a `.background`/`.overlay` é SEMPRE via closure; e os diagnósticos
"Color has no member accent" do editor são falso-positivo de análise isolada (sem contexto do alvo) — a verdade é o build.

## 2026-07-11 · CONDUTA · andaime de captura (J3) + auto-save do repositório — verifiquei o HEAD, não só o working tree
- Tags: worktree, auto-save, andaime, screenshot, home-dia-de-pista
- Situação: pra fotografar CarroRowCompacta/NumerosRodape no simulador (fronteira dura = só meus 2 arquivos), pendurei um branch TEMPORÁRIO `--p1-j3-preview` + `J3PreviewHostTEMP` no ContentView.swift (arquivo de outra janela).
- Risco (armadilha já registrada 2026-07-05): o hook de auto-save deste repo commita sozinho; podia versionar o andaime no ContentView. E de fato o auto-save commitou o CarroRowCompacta.swift (commit f8d6c356) enquanto eu trabalhava.
- Correção/conduta: revertí o ContentView com `git checkout` e CONFERI O HEAD (`git show HEAD:…ContentView.swift | grep -c` = 0) + `git log 68813c12..HEAD -- ContentView.swift` vazio → andaime nunca entrou em commit. Entrega final = só os 2 componentes (+ pbxproj regenerado).
- Verificação: CORRIGIDO COM PROVA — HEAD limpo do andaime; foto prova os componentes; build verde.
- Lição: em repo com auto-save, andaime temporário em arquivo alheio SEMPRE reverter E conferir o HEAD e o log da branch (não só o working tree), porque o auto-save pode ter versionado no meio.
