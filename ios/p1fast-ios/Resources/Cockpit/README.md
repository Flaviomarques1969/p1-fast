# Cockpit do Piloto — cópia embutida no app (vendored)

Cópia do cockpit web canônico em `web/cockpit/`, embutida no app iOS pra mostrar a tela
"Cockpit do Piloto" (CockpitPilotoView) funcionando offline, idêntica ao que o piloto vê.
Aparece ao **girar o celular pra paisagem** (sem botão).

## É a VERSÃO APROVADA (Flávio 2026-06-22)
`cockpit-app.html` = cópia de `web/cockpit/cockpit-volta-real.html` (o **painel APROVADO**)
+ ajuste SÓ de apresentação (escala o device pra caber no iPhone) + os `fetch()` apontados
pra cá (relativos `./`). Backup congelado do aprovado:
`_design-reference/versions/cockpit-painel-APROVADO-2026-06-22.html`.

## Arquivos (origem = `web/cockpit/` + dados)
- `cockpit-app.html`    ← `cockpit-volta-real.html` + ajuste de apresentação + fetch relativos
- `cockpit.css`         ← idêntico
- `cockpit-state.js`    ← idêntico  (importado)
- `cockpit-renderer.js` ← idêntico  (importado)
- `live-data-bridge.js` ← idêntico  (importado)
- `apice-calculator.js`, `trecho-detector.js` ← SOBRA da vitrine antiga; o painel aprovado
  NÃO importa estes dois (podem ser removidos numa limpeza).
- `volta-real-pista-24-05.json` ← dados da volta real (GPS + motor) que o replay reproduz
- `BARRAS-BRASILIA-FLAVIO-APROVADO-2026-05-27.json` ← curvas/ápices de Brasília

## Como atualizar (se o painel web mudar)
1. Recopiar `cockpit-volta-real.html` de `web/cockpit/` como `cockpit-app.html`.
2. Refazer o ajuste de apresentação (bloco `<style>`/`fit()`).
3. Trocar os 2 `fetch()` absolutos (`/web/cockpit/fixtures/...`, `/_design-reference/...`)
   por relativos `./`.
4. Recopiar os 3 módulos JS e os 2 JSON se tiverem mudado.

## Por que embutido e não da web publicada
`index-t3000.html` é a página do NOTEBOOK: lê a injeção pela USB (WebSerial), que não existe
no iPhone. O painel aprovado roda sozinho (replay da volta real, sem USB/nuvem/internet).
Espelhar o carro AO VIVO é o passo seguinte.

Servido por scheme próprio (`cockpit://`) via WKURLSchemeHandler (CockpitPilotoView.swift) —
dá origem válida pros `import` ES e pros `fetch()` (file:// quebraria por CORS).
