# Cockpit do Piloto — cópia embutida no app (vendored)

Estes arquivos são uma **cópia** do cockpit web canônico em `web/cockpit/`, embutida no
app iOS pra mostrar a tela "Cockpit do Piloto" (CockpitPilotoView) funcionando offline,
idêntica ao que o piloto vê.

## Origem (fonte da verdade = `web/cockpit/`)
- `cockpit-app.html`  ← cópia de `cockpit-vitrine.html` + ajuste SÓ de apresentação
  (esconde a barra de vitrine e escala o device pra caber no iPhone; device e lógica intactos).
- `cockpit.css`        ← idêntico
- `cockpit-state.js`   ← idêntico
- `cockpit-renderer.js`← idêntico
- `live-data-bridge.js`← idêntico
- `apice-calculator.js`← idêntico
- `trecho-detector.js` ← idêntico

## Como atualizar (se o cockpit web mudar)
Recopiar os 6 arquivos canônicos de `web/cockpit/` e refazer só os 2 ajustes de
apresentação no `cockpit-app.html` (bloco `<style>` extra no `<head>` + `<script>` de
`fit()` antes de `</body>`). Os módulos JS são o fecho de dependências da vitrine
(`cockpit-state` + `cockpit-renderer` + `live-data-bridge` → `apice-calculator`, `trecho-detector`).

## Por que não carrega da web publicada
O cockpit ao vivo publicado (`index-t3000.html`) é a página do NOTEBOOK: lê a injeção
pela USB (WebSerial, botão "Autorizar"), que não existe no iPhone. A vitrine roda
sozinha (sem USB, sem nuvem, sem internet), então é o que espelha o cockpit no celular.

Servido no app por um scheme próprio (`cockpit://`) via WKURLSchemeHandler — assim os
módulos ES (`import`) carregam com origem válida (file:// quebraria os imports).
