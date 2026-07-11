# BRIEFING — portar a luz de marcha do WinUI de 12 → 17 luzes (igual ao painel APROVADO 22/06)

> Para a sessão Claude do NOTEBOOK (Windows). Origem deste briefing: sessão do Mac, 24/06/2026.
> Trabalhe na linha de sincronização `sync/notebook-dia-de-pista-2026-06-23`. NÃO mexer na versão
> oficial (main). NÃO publicar nada (cockpit-bubi-live é PRODUÇÃO: ouvir pode, publicar NÃO).

## OBJETIVO (1 frase)
A barra de luz de marcha da tela WinUI (cockpit do piloto) tem hoje **12 luzes**; tem que ficar
**IDÊNTICA ao painel aprovado em 22/06 — 17 luzes** em pirâmide simétrica, mesmas cores, mesma
direção de acender e mesmos estados (apagado/aceso/crítico/overrev/flash de troca).

## FONTE CANÔNICA DO VISUAL (copiar o comportamento DAÍ, não inventar)
- `_design-reference/versions/cockpit-painel-APROVADO-2026-06-22.html` (congelado, é a verdade visual).
- Estrutura das 17 luzes lá (data-tier da esquerda p/ direita, simétrica):
  `1,2,3,4,5,6,7,8,9, 8,7,6,5,4,3,2,1` (centro = tier 9, o mais alto; pontas = tier 1).
- Lógica de quando/como acende: `web/cockpit/shift-light-orquestrador.js` (+ `web/cockpit/shift-light-modos.js`).
- ⚠️ CONFERIR A DIREÇÃO DE ACENDER no aprovado e REPLICAR igual. O WinIU hoje acende do CENTRO p/ fora;
  o aprovado pode acender das PONTAS p/ o centro. NÃO assumir — ler o aprovado e bater igual.

## PEÇAS EXATAS A ALTERAR (caminhos e linhas reais, conferidos no Mac em 24/06)
1. `windows/cockpit/P1Fast.Cockpit.UI/MainWindow.xaml` (linhas ~82–95):
   - Trocar os 12 `<Ellipse x:Name="Led01..Led12">` por **17** (`Led01..Led17`) dentro do mesmo
     `<StackPanel Orientation="Horizontal" Spacing="18">`. Se o aprovado variar tamanho por tier
     (pontas menores, centro maior), refletir isso; senão manter 13×13 igual hoje.
2. `windows/cockpit/P1Fast.Cockpit.UI/MainWindow.xaml.cs`:
   - linha ~60: `LedTierByPosition = { 1,2,3,4,5,6,6,5,4,3,2,1 }` → pirâmide de 17:
     `{ 1,2,3,4,5,6,7,8,9,8,7,6,5,4,3,2,1 }`.
   - linha ~111: `_leds = new[] { Led01..Led12 }` → incluir `Led13..Led17`.
   - linha ~457: `if (_leds.Length != 12) return;` → `!= 17`.
   - `ColorForTier` (linha ~544): hoje mapeia tiers 1–6 (verde/amarelo/vermelho). Estender p/ tiers
     1–9 com a MESMA rampa de cor do aprovado (ler os oklch do .html e converter; verde nas pontas →
     amarelo no meio do caminho → vermelho no centro). Conferir os RGB de `LedTier1Green/3Yellow/5Red`
     (linhas ~54–56) contra o aprovado.
3. `windows/cockpit/P1Fast.Cockpit.Domain/CockpitState.cs` (linha ~325, `ShiftDotsForLevel(level)`):
   - Hoje devolve nº de luzes p/ 12. Reescalar p/ 17 de modo que o nível máximo acenda as 17 e a
     progressão por nível bata com o aprovado. Ajustar os testes que dependem disso, sem afrouxá-los.

## PRESERVAR (não quebrar o que já funciona)
- Flash branco de troca (`BeginShiftFlash`/`RenderShiftLeds` modo Fire) e o vermelho de `Overrev`
  devem continuar — só passam a varrer as 17.
- Toda a demais tela intacta. Não apagar nada; só somar/ajustar a barra.

## REGRAS DURAS (não reabrir)
- 17 luzes é SÓ do painel do PILOTO. Troca acende rumo à **POTÊNCIA MÁXIMA (6.050 rpm)**, NÃO no
  redline (6.300). Isso já está na lógica — não mudar o gatilho, só o desenho/contagem.
- Tela 10,5" deitada, largura toda, sem moldura de celular, **sem emoji** (só ícone de traço/SVG).
- Sempre "você", nunca "tu". Não publicar em cockpit-bubi-live.

## PROVAR ANTES DE DIZER PRONTO (e relatar o resultado real)
- `cd windows/cockpit && DOTNET_ROLL_FORWARD=Major dotnet test P1Fast.Cockpit.Domain.Tests` → tem que
  ficar **verde** (hoje 262/262). Se algum teste de shift mudar de número por causa das 17, ajustar o
  teste pro novo esperado correto (não desligar teste).
- Empacotar/rodar a tela e CONFERIR a olho contra o aprovado: 17 luzes, pirâmide, cores e direção de
  acender idênticas. Mandar print/relato.
- Relatar: o que mudou, em quais arquivos, resultado dos testes, e o que NÃO deu pra provar.
