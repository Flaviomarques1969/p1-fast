# Continuidade — integrar T4000 no carro (handoff atualizado 2026-05-25 noite)

> **Para qualquer Claude que continuar esta tarefa (celular, novo iMac, novo /clear):**
> Este documento é a fonte da verdade. Leia ele PRIMEIRO. Depois `STATUS.md`. Não pergunte ao Flávio o que está escrito aqui. Não proponha caminhos já descartados (veja seção "Caminhos JÁ descartados — não reabrir").

## Estado atual (25/05 noite)

Flávio está no notebook Samsung Windows, com a T4000 plugada via USB. Acabou de confirmar que:
- A página de teste `https://p1t4000.vercel.app` carrega corretamente no navegador (Edge/Chrome).
- A T4000 funciona (testado com o aplicativo proprietário da Injepro no mesmo notebook).
- Engenharia da Injepro afirmou: "via Windows nós conseguimos" ler os dados.

**Próximo passo concreto:** o Flávio vai conectar a T4000 dentro dessa página (botão "1) Conectar via WebUSB", se não der, "2) Conectar via WebHID") e reportar o resultado.

## Objetivo final (não esquecer)

Aquisição de dados dos sensores e dados do carro vindos da Injepro T4000, pra mostrar no painel do piloto durante a pilotagem. **Esta tarefa é só a parte de aquisição.** Painel já existe e está pronto pra consumir os dados.

## Caminhos JÁ descartados — não reabrir

| Caminho | Por que descartado |
|---|---|
| Adaptador C# em cima de `System.IO.Ports.SerialPort` | Testado em campo 25/05. Zero bytes. A USB da T4000 NÃO expõe porta serial COM padrão. É USB proprietária. |
| Programa `T4000Capture` no notebook Windows (single-file .exe) | Mesmo motivo. Não chega a abrir porta serial nenhuma porque a Injepro não aparece como COM. |
| Adaptador USB-CAN externo (CANable v2.0) | Continua sendo plano B viável, mas só recorrer se WebUSB e WebHID **ambos** falharem. Custo R$ 200-400, exige conhecer pinout do chicote da T4000. |
| Bluetooth da T4000 | Spec proprietária, não temos. Telefonar pra Injepro pode levar semanas. Última opção. |

## Caminho atual em uso

**Página HTML pública usando WebUSB / WebHID** (tecnologias do navegador moderno que falam direto com aparelhos USB proprietários, sem precisar de driver de porta COM).

- **Endereço público:** `https://p1t4000.vercel.app` (HTTPS válido, sem trava de login).
- **Código-fonte na versão oficial:** `web/cockpit/t4000-usb-test.html` (submissão #211 incorporada 25/05 noite).
- **Hospedagem:** Vercel, projeto `p1t4000` do escopo `flaviomarques-6007s-projects`.
- **Como atualizar a página:** alterar o arquivo, registrar e enviar pra versão oficial, depois rodar `cd /tmp/p1-t4000 && cp /Users/imac/Projetos/P1\ Fast/web/cockpit/t4000-usb-test.html /tmp/p1-t4000/index.html && npx vercel deploy --prod --yes --scope=flaviomarques-6007s-projects` pra publicar o novo conteúdo.

## Fluxo no carro (o que o Flávio está fazendo agora)

1. ✅ Notebook ligado na internet.
2. ✅ T4000 plugada via USB.
3. ✅ Página `p1t4000.vercel.app` aberta no Edge/Chrome.
4. ⏳ **Clicar "1) Conectar via WebUSB"** → diálogo do navegador lista os USB conectados → escolher a T4000 (provavelmente listada como "Injepro" ou parecido) → "Conectar".
5. ⏳ Olhar o quadro "Tráfego de dados":
   - **"Bytes recebidos (total)" subindo** → DEU CERTO. Manda print pro Claude.
   - **Bytes em 0** → clica em "2) Conectar via WebHID" e repete passo 4.
   - **Ainda bytes em 0 nas duas tentativas** → manda print do quadro "Dispositivo conectado" (VID:PID, Fabricante, Produto, Serial, Classe USB).
6. ⏳ Quando bytes estiverem subindo, esperar 30s+ e clicar "Baixar log .bin". Mandar o arquivo pro Claude.

## O que o Claude do celular precisa fazer em cada caso

### Caso A — bytes subindo + sentinelas Injepro P4 e P5 detectadas (>0)

**Significa:** WebUSB/WebHID conectou e a T4000 está enviando o protocolo CAN exatamente como o PDF documenta (sentinelas `0x1E 0xFC` no fim do pacote 4 e `0xFB 0xFA` no início do pacote 5).

**Próxima ação:**
1. Pedir ao Flávio o arquivo `.bin` baixado.
2. Validar o checksum dos primeiros 10 ciclos (deve bater com `T4000PacketParser` em `windows/cockpit/P1Fast.Cockpit.Domain/`).
3. Atualizar `STATUS.md` marcando MS-9.1 (captura real do barramento) como ✅.
4. Sprint seguinte: estender a página `p1t4000.vercel.app` pra **mostrar o painel canônico do piloto** consumindo os dados ao vivo (pra Flávio ver no notebook como se já fosse o produto final). Base já pronta em `web/cockpit/index-live.html` + `cockpit-renderer.js` + `live-data-bridge.js`.

### Caso B — bytes subindo mas sentinelas P4/P5 em 0

**Significa:** A USB cospe dados, mas em formato diferente do CAN. Provavelmente um protocolo proprietário Injepro (sobre USB CDC, USB HID, ou USB raw).

**Próxima ação:**
1. Pedir o `.bin` ao Flávio.
2. Analisar o conteúdo: olhar repetições, períodos, valores constantes vs variáveis.
3. Comparar com captura USB do programa proprietário Injepro rodando (Flávio pode capturar com Wireshark + USBPcap se topar — instalar 1 programa novo, gravar 30s rodando o app da Injepro, mandar o arquivo).
4. Engenharia reversa do protocolo: identificar cabeçalho, payload, checksum próprio.
5. Construir decodificador novo em JS dentro da própria página.

### Caso C — zero bytes em WebUSB E WebHID

**Significa:** O aparelho USB da Injepro não responde a comandos genéricos de leitura — exige handshake específico (sequência inicial de bytes que o software da Injepro envia pra "destravar" o stream).

**Próxima ação:**
1. Capturar o tráfego USB com Wireshark + USBPcap enquanto o software da Injepro está rodando (Flávio precisa instalar + gravar).
2. Identificar o handshake nos primeiros bytes que vão do PC pra T4000.
3. Replicar esse handshake na página WebUSB (`navigator.usb.controlTransferOut` ou `navigator.hid.sendReport`).
4. Se não conseguir, recorrer ao plano B (adaptador USB-CAN externo) — comprar CANable v2.0 (R$ 200-400) e conectar ao chicote CAN do conector de 34 vias da T4000.

## Linha de trabalho

Estamos em `main`. Submissões mais recentes incorporadas à versão oficial:
- #210 (25/05 noite) — handoff anterior (descartado pelo caminho do .exe que não funcionou).
- #211 (25/05 noite) — página WebUSB/WebHID em produção em `p1t4000.vercel.app`.

Próxima submissão deve partir de `origin/main` em ambiente isolado de trabalho novo.

## Memória do projeto a atualizar pós-sucesso

Quando o caso A ou B fechar com bytes confirmados, criar memória de projeto:
- `~/.claude/projects/-Users-imac-Projetos-P1-Fast/memory/p1-fast-t4000-webusb-2026-05-XX.md`
- Conteúdo: USB da Injepro T4000 NÃO é serial COM. Caminho confirmado em campo: WebUSB / WebHID via navegador moderno. Endereço de produção: `p1t4000.vercel.app`. Código em `web/cockpit/t4000-usb-test.html`.

## Prompt copia-e-cola pro Claude Code do celular

```
Estou no carro com o notebook Samsung Windows e a T4000 plugada. Acabei de abrir a página https://p1t4000.vercel.app no Edge.

Lê docs/HANDOFF_T4000_NOTEBOOK_2026-05-25.md PRIMEIRO antes de me responder. Não me peça pra fazer coisa que já está respondida lá. Sigo as instruções da seção "Fluxo no carro" e te mando print do que aparecer. Você reage conforme as seções "Caso A / B / C" do mesmo documento.
```
