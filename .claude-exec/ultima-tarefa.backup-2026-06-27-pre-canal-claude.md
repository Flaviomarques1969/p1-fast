# TASK — Cockpit do piloto (notebook Windows): luz de marcha 12 → 17 luzes

> Registro anterior (login multi-aparelho) preservado em
> `.claude-exec/ultima-tarefa.backup-2026-06-26-pre-17luzes.md`.

## 1. Pedido original de Flávio
"notebook p1 fast" → retomar a tarefa do briefing `BRIEFING-NOTEBOOK-17-LUZES.md`:
portar a barra de luz de marcha do cockpit do piloto (app Windows/WinUI) de **12 → 17 luzes**,
idêntica ao painel aprovado em 22/06. Flávio escolheu (card 26/06): **fazer agora no Mac**.

## 2. Objetivo (1 frase)
Deixar a barra de luz de marcha do app Windows com 17 luzes em pirâmide (1..9..1), enchendo das
pontas pro centro, cores verde→amarelo→vermelho, central só na troca — igual ao mockup aprovado.

## 3. Critérios objetivos de conclusão
- XAML com 17 elipses `Led01..Led17` (mantendo 13×13).
- `LedTierByPosition` = pirâmide de 17: `{1,2,3,4,5,6,7,8,9,8,7,6,5,4,3,2,1}`.
- `_leds` inclui `Led13..Led17`; guarda `_leds.Length != 17`.
- Direção de acender = **pontas → centro** (par a par); LED central (tier 9) só acende na troca/over.
- `ColorForTier` estende tiers 1–9: 1–4 verde, 5–7 amarelo, 8–9 vermelho (igual mockup).
- `ShiftDotsForLevel`/`ShiftDotsTotal` reescalados; testes Domain ajustados sem afrouxar.
- `dotnet test P1Fast.Cockpit.Domain.Tests` **verde**.
- Flash de troca e overrev preservados, varrendo as 17.

## 4. Leitura confirmada
- `~/.claude/CLAUDE.md` — sim
- `~/.claude-decisoes/padroes.md` — sim (sem padrões registrados ainda)
- `~/.claude/FLAVIO_EXECUTION_PROTOCOL.md` — sim
- `~/.claude/FLAVIO_DONE_CHECKLIST.md` — sim
- `~/.claude/FLAVIO_ENVIRONMENT_RULES.md` — sim
- `~/.claude/FLAVIO_COMMUNICATION_RULES.md` — sim
- `P1 Fast/CLAUDE.md` + `_design-reference/.../cockpit-painel-APROVADO-2026-06-22.html` +
  `web/cockpit/mockup-shift-light-progressivo.html` (spec da direção/cores) — sim

## 5. Plano (≤5 passos)
1. Worktree da linha `sync/notebook-dia-de-pista-2026-06-23` (não tocar main).
2. XAML: 12 → 17 elipses.
3. C#: `LedTierByPosition`, `_leds`, guarda, `ColorForTier`, renderização pontas→centro com central na troca.
4. Domínio: `ShiftDotsTotal`/`ShiftDotsForLevel` + testes CST_03/CST_04.
5. `dotnet test` Domain → verde; relatar. Conferência VISUAL fica pro notebook Windows.

## 6. Áreas a inspecionar (já inspecionadas)
- `windows/cockpit/P1Fast.Cockpit.UI/MainWindow.xaml` (linhas 69–96)
- `windows/cockpit/P1Fast.Cockpit.UI/MainWindow.xaml.cs` (53–60, 111, 457, 513–550)
- `windows/cockpit/P1Fast.Cockpit.Domain/CockpitState.cs` (22–24, 325–330)
- `windows/cockpit/P1Fast.Cockpit.Domain.Tests/CockpitStateTests.cs` (CST_03, CST_04)

## 7. Ambiente alvo
desenvolvimento

## 8. Produção protegida
sim

## 9. Autorização para produção
não

## 10. Evidência da autorização para produção
não recebida (não se aplica — é app Windows local, não publica em cockpit-bubi-live)

## 11. Riscos
- WinUI não roda no Mac → **conferência visual das 17 luzes só no notebook Windows**.
- Direção de acender está INVERTIDA hoje (centro→fora); corrigir pode parecer mudança grande.
  Reversível (worktree, fora da main).
- 17 é ímpar → cuidado pra o LED central não "sumir" na renderização.

## 12. Status inicial
iniciado

---

## TASK_DONE (26/06)
```
TASK_DONE:
- Pedido original conferido: sim
- Ambiente trabalhado: desenvolvimento (worktree da linha sync, fora da main)
- Produção foi alterada: não
- Se produção foi alterada, autorização explícita registrada: n/a
- Arquivos reais inspecionados: sim
- Alterações feitas: sim (4 arquivos)
- Testes/validação executados: sim (dotnet test Domain — 261/262; PAN_04 falha pré-existente provada)
- Resultado: parcial — código pronto e domínio provado; CONFERÊNCIA VISUAL pendente no notebook Windows
- Pendências reais: build da UI + olhar as 17 luzes no Windows (WinUI não roda no Mac)
```

### Achado-chave
Direção de acender estava INVERTIDA hoje (centro→fora). O mockup aprovado
(`web/cockpit/mockup-shift-light-progressivo.html`) manda **pontas→centro**, central só na troca.
Corrigido para bater com o aprovado.

### Onde está
Worktree `/Users/imac/Projetos/p1fast-worktrees/notebook-17-luzes`, branch
`sync/notebook-dia-de-pista-2026-06-23`, commit local `b179ceb9` — NÃO enviado.

### Arquivos alterados (4)
- `windows/cockpit/P1Fast.Cockpit.UI/MainWindow.xaml` (17 elipses + comentário)
- `windows/cockpit/P1Fast.Cockpit.UI/MainWindow.xaml.cs` (tiers, _leds, guarda, ColorForTier, render pontas→centro)
- `windows/cockpit/P1Fast.Cockpit.Domain/CockpitState.cs` (ShiftDotsTotal=17, ShiftTiersPerSide=8, ShiftDotsForLevel)
- `windows/cockpit/P1Fast.Cockpit.Domain.Tests/CockpitStateTests.cs` (CST_03, CST_04)

### Não compilado no Mac
WinUI 3 é só Windows → o código da UI (.xaml/.xaml.cs) foi revisado a olho mas NÃO passou
pelo compilador aqui. Só o Domínio + testes compilaram e rodaram.

---

## TASK 2 (26/06) — "apenas que tudo funcione" (produto WEB)
Pedido: garantir que o produto web está de pé. Rodei os 82 testes de fumaça.
- Estado inicial: 80/82. 2 falhas (travas de consistência desatualizadas, NÃO o app quebrado).
- Investiguei as 2 (sem mexer), trouxe plano, Flávio autorizou aplicar os dois.

Conserto (SÓ em verificações, zero mudança em app/banco/pista):
1. `tests/node-smoke-arquitetura-dado.mjs` — incluí `ios/.../pista-oficial-brasilia.js` na
   lista de exceções (é calibração do DESENHO, igual ao gêmeo web já isento).
2. `tests/node-smoke-schema-parity.mjs` — contagem 46→51; `sessao_dumps` marcada só-nuvem
   (caixa de resgate temporária 0048); `checklist_item`/`checklist_tique` marcadas só-celular
   (lista padrão local; o que sincroniza é stint_check/dia_check, que já espelha).

Validação: 82/82 testes de fumaça verdes + bateria `test:shift-light` toda verde.
Escopo confirmado: diff só nos 2 arquivos de teste; nada em web/src/ios/supabase.
Estado: o salvamento automático registrou na versão oficial LOCAL; NÃO enviado pro
compartilhado (GitHub) — local está ~1890 registros à frente, envio é manual/auditado.
Resultado: CONCLUÍDO.

