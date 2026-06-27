# RUNBOOK — DIA DE PISTA (operado pelo Claude no notebook)

> **Quem executa:** a sessão do Claude **no notebook Windows**, na pista, a mando do Flávio.
> **Objetivo:** capturar (motor T4000 + GPS RaceBox), ler/validar, publicar pra nuvem e
> coordenar com o **iMac** (app na nuvem) — por voz do Flávio, sem ele operar comandos.
> **Tratamento:** sempre "você". **Criado:** 2026-06-27.
>
> Atalhos: `DOTNET="C:/Program Files/dotnet/dotnet.exe"` · raiz do repo = `C:/Users/flavi/P1fast`.
> Produção (`--producao` / canal `cockpit-bubi-live`) **só com ordem expressa do Flávio**.

---

## 0. PREFLIGHT (ao chegar) — uma vez
```bash
cd "C:/Users/flavi/P1fast"
# build da solução (Domain/Analise/Upload/Demo/Tests/MotorProbe)
"C:/Program Files/dotnet/dotnet.exe" build windows/cockpit/P1Fast.Cockpit.sln -c Debug 2>&1 | tail -3
# chave da nuvem + internet + canal de mensagens
powershell -NoProfile -Command "[bool][Environment]::GetEnvironmentVariable('P1FAST_SUPABASE_ANON','User')"
curl -s -o /dev/null -w "Supabase: %{http_code}\n" --max-time 8 https://fvhwltzhytpnhlqbttmd.supabase.co/auth/v1/health
git ls-remote origin refs/heads/claude-comms | head -1
```
Verde = `0 Erro(s)`, `True`, `Supabase: 401`, e um hash do `claude-comms`.

## 1. APARELHOS (na bancada do carro)
- **T4000:** plugar **energizada** (chave/ignição ON ou fonte no chicote — só USB não acorda) com **cabo de DADOS**, direto na USB do notebook.
- **RaceBox:** ligado (Bluetooth) — conecta sozinho no `--live`.
- Conferir T4000 presente:
```bash
powershell -NoProfile -Command "Get-PnpDevice -PresentOnly | ? { \$_.InstanceId -match 'VID_04D8&PID_014A' } | fl Status,FriendlyName"
```

## 2. VEREDICTO DO MOTOR (antes do --live, opcional mas recomendado)
```bash
cd "C:/Users/flavi/P1fast/windows/cockpit"
"C:/Program Files/dotnet/dotnet.exe" run --project P1Fast.Cockpit.MotorProbe -c Debug
```
Espera a T4000 aparecer, lê 12 s, imprime stats + 1ª amostra. **`SamplesEmitted>0` + "VALIDADO"** = motor lendo.

## 3. CAPTURA AO VIVO (cockpit do piloto + gravação)
```bash
EXE="C:/Users/flavi/P1fast/windows/cockpit/P1Fast.Cockpit.UI/bin/x64/Debug/net8.0-windows10.0.19041.0/P1Fast.Cockpit.UI.exe"
# TESTE (canal cockpit-bubi-dev-teste; não toca produção):
powershell -NoProfile -Command "Start-Process '$EXE' -ArgumentList '--live','--windowed'"
# PRODUÇÃO (canal cockpit-bubi-live que o app/Command Box assistem) — SÓ com ordem do Flávio:
# powershell -NoProfile -Command "Start-Process '$EXE' -ArgumentList '--live','--producao'"
```
- O motor entra sozinho quando a T4000 aparece (supervisor resiliente). GPS entra pelo RaceBox.
- **Tudo grava** em `~/p1fast-sessoes/*.jsonl` (fonte da verdade, 25 Hz, todas as voltas) — funciona mesmo sem internet.
- Fechar a janela do `.exe` encerra a sessão limpa.

## 4. VERIFICAR A GRAVAÇÃO (durante/depois)
```bash
ls -t "$USERPROFILE/p1fast-sessoes"/*.jsonl | head -1   # sessão mais recente
# contagem gps/motor da última:
F=$(ls -t "$USERPROFILE/p1fast-sessoes"/*.jsonl | head -1)
grep -c '"Tipo":"gps"' "$F"; grep -c '"Tipo":"motor"' "$F"
```

## 5. ANÁLISE — Vmin por trecho + ponto de frenagem (Brasília)
```bash
cd "C:/Users/flavi/P1fast/windows/cockpit"
"C:/Program Files/dotnet/dotnet.exe" run --project P1Fast.Cockpit.Analise -c Debug
# (sem args: pega a .jsonl mais recente + trechos de Brasília; gera <sessao>.vmin.csv)
```

## 6. SUBIR A SESSÃO PRA NUVEM (pro app / iMac)
```bash
cd "C:/Users/flavi/P1fast/windows/cockpit"
F=$(ls -t "$USERPROFILE/p1fast-sessoes"/*.jsonl | head -1)
"C:/Program Files/dotnet/dotnet.exe" run --project P1Fast.Cockpit.Upload -c Debug -- "$F" --sessao-id=PISTA-$(date -u +%Y%m%dT%H%M%SZ)
# carimba UUIDs (Bubi/Brasília) no sessao_meta; sobe em pedaços pra sessao_dumps.
```

## 7. CHECAR A NUVEM (round-trip — baixar e recontar)
```bash
# (PowerShell) baixa a sessão de sessao_dumps e remonta — confirma que chegou fiel.
# trocar <SID> pelo sessao_id usado no passo 6.
```
Usa o GET `/rest/v1/sessao_dumps?sessao_id=eq.<SID>&order=parte` com header `apikey`+`Authorization` = `P1FAST_SUPABASE_ANON`.

## 8. FALAR COM O iMac (canal `claude-comms`)
**Ler o que o iMac mandou:**
```bash
cd "C:/Users/flavi/P1fast"
git fetch origin claude-comms -q
LAST=$(git ls-tree -r --name-only origin/claude-comms | grep para-notebook | sort | tail -1)
git cat-file -p "origin/claude-comms:$LAST"
```
**Mandar recado (via worktree, sem trocar de branch):**
```bash
TS=$(date -u +%Y%m%dT%H%M%SZ); WT="/c/Users/flavi/AppData/Local/Temp/cc-wt"
git worktree remove "$WT" --force 2>/dev/null; git fetch origin claude-comms -q
git worktree add -B claude-comms "$WT" origin/claude-comms; git -C "$WT" sparse-checkout disable
printf '%s\n' "<recado>" > "$WT/mensagens/${TS}-de-notebook-para-imac.md"
git -C "$WT" add -A && git -C "$WT" commit -q -m "msg notebook->imac: ..." && git -C "$WT" push origin claude-comms
git worktree remove "$WT" --force
```
> Divisão no dia: **notebook publica o ao vivo**; **iMac valida/processa no app da nuvem**; coordenam por aqui.
> Os dois mantêm vigia ativo (checam o canal a cada ~60 s).

## 9. IR AO VIVO EM PRODUÇÃO (gate do Flávio)
1. Flávio dá a ordem.
2. Subir o `.exe` com `--producao` (passo 3) → publica no `cockpit-bubi-live`.
3. Avisar o iMac pelo `claude-comms` que está ao vivo em produção; ele confirma recepção.

---

### Notas de campo
- **Sem internet:** captura + disco funcionam 100% offline. Nuvem/iMac voltam quando a conexão volta (upload retoma; o disco é a verdade).
- **Motor caiu:** o supervisor religa sozinho; se persistir, rodar o passo 2 (probe) — stats dizem se é cabo/energia/handshake.
- **Pista ≠ Brasília:** a análise por-trecho (passos 2/5) usa os trechos de Brasília; outra pista precisa dos trechos dela definidos antes.
