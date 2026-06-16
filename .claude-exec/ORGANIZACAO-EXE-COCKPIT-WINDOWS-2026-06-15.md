# Organização — Programa .exe do Cockpit do Piloto (Windows nativo)

Data: 2026-06-15
Status: em construção (preparação no Mac → execução na sessão do notebook Windows)
Ambiente: DESENVOLVIMENTO. Produção P1 Fast NÃO é tocada nesta tarefa.

## Objetivo

Um programa `.exe` nativo que roda no notebook Windows do piloto, 100% local/offline, e é o
PAINEL DO PILOTO na pista. Ele:
- lê a central de motor Injepro (Bubi) pelo cabo USB;
- lê o GPS/IMU RaceBox Mini S por Bluetooth (25 Hz);
- desenha o painel (12 luzes de marcha, halo, delta, barra de stint, alertas, mapa);
- REQUISITO Nº 1 INEGOCIÁVEL: máxima rapidez, baixa latência e ESTABILIDADE TOTAL — não pode
  travar, engasgar nem fechar com o piloto na pista.

## Decisão de tecnologia (auditada, sem viés)

Auditoria comparou 5 caminhos (C#/.NET 8 + WinUI 3; C# + Avalonia; C++; Rust; site empacotado
em Electron), com juiz comparativo e advogado do diabo. Resultado:

- ESCOLHIDO: **C#/.NET 8 + WinUI 3** (continuar o que já existe). Motivo: o "cérebro" lógico já
  está escrito e com 151 testes automáticos passando; a tela já está desenhada; compila no
  próprio notebook do Flávio (onde a validação com hardware acontece). A carga de dados é baixa,
  então C++/Rust ganhariam só latência imperceptível e perderiam tempo e segurança de entrega.
- PLANO B (rede de segurança): empacotar o site que JÁ funciona (lê os dois aparelhos de verdade)
  como `.exe` via Electron. Acionar SOMENTE se o Bluetooth nativo consumir tempo inaceitável.

## ACHADO CRÍTICO — resolver no passo 1 (antes de confiar no cérebro pronto)

O parser C# existente (`T4000PacketParser`) assume protocolo CAN ID 0x7FB (5 pacotes de 8 bytes,
push streaming). MAS o único caminho PROVADO com o aparelho real é o site, que usa OUTRO
protocolo: handshake "ACK"→"OK", depois pergunta "RI" e recebe um BLOCO de ~410-490 bytes
(pergunta-resposta). Os 151 testes provam o parser contra uma fixture, NÃO contra o aparelho
físico do Bubi. Risco real: o cérebro pronto pode estar decodificando no formato errado.

AÇÃO (passo 1 da sessão Windows): plugar a Injepro, capturar os bytes crus
(`windows/cockpit/P1Fast.Cockpit.T4000Capture` já abre a porta e grava), comparar com o que o
site faz (`web/cockpit/main-t3000.js` + `t3000-usb-parser.js`). Se o aparelho responder em
RI/bloco, usar o tradutor PORTADO DO SITE (validado contra o software oficial Injepro em 26/05),
não o parser CAN.

## Protocolos conhecidos (fontes canônicas — detalhes completos nos arquivos)

- Motor (Injepro), caminho PROVADO em campo: `web/cockpit/main-t3000.js` (handshake/loop,
  linhas ~724-921) + `web/cockpit/t3000-usb-parser.js` (offsets/escala/unidade, linhas 62-237).
  USB vendor-specific VID 0x04D8 / PID 0x014A; comandos ASCII "ACK"/"RI" sem terminador.
- GPS RaceBox 25 Hz: `web/teste-aparelhos/index.html` (linhas ~388-502). Nordic UART Service
  (UUID 6e400001.../notify 6e400003...), frame estilo UBX (header 0xB5 0x62, class 0xFF id 0x01,
  checksum Fletcher), payload >= 80 bytes. Offsets-chave no payload: fix p[20], satélites p[23],
  lon int32@24 /1e7, lat int32@28 /1e7, precisão uint32@40 /1000, vel int32@48 /1000*3.6.

## Modo de trabalho — LAÇO AUTO-CORRETIVO

A sessão do Claude no notebook executa, repetindo sozinha até verde e estável:
1. montar (build) → 2. rodar os testes automáticos → 3. se erro, ler o erro e corrigir →
4. repetir. A cada mudança, os testes rodam de novo.

Estabilidade (requisito nº 1), verificável por registro (log), sem olho humano:
- VIGIA que roda o programa e força quedas de USB e de Bluetooth, confirmando religação automática;
- TESTE DE HORAS SEGUIDAS (soak) com quedas forçadas, sem travar nem vazar memória, antes de pista;
- medir as pausas internas (GC) no próprio notebook antes de ligar ajustes — não no chute.

Só precisa do olho humano do Flávio: aprovação visual da tela e conferência de que a posição no
mapa bate com a pista real.

## Pré-requisitos físicos no notebook (ação do Flávio)

- Notebook LIGADO, no WiFi, e configurado para NÃO suspender/dormir.
- Injepro plugada no cabo USB, com a CHAVE DO CARRO EM ON (sem isso ela não transmite).
- RaceBox ligado e pareado (o fix de GPS real exige céu aberto — fica para a fase de pista).
- Abrir o Claude no notebook quando for a hora (a sessão de trabalho local).
- Instalar as ferramentas de montagem (.NET 8 SDK etc.): a própria sessão faz sozinha.

## Ordem do trabalho

1. (Windows, passo 1) Confirmar o formato real dos dados da Injepro (resolver o ACHADO CRÍTICO).
2. Bluetooth do GPS (RaceBox) PRIMEIRO — maior incerteza: conectar + receber + derrubar +
   religar sozinho por horas, em prova isolada, antes de integrar.
3. Ligar a leitura do motor no formato confirmado no passo 1.
4. Ligar tudo na tela (remover o modo demonstração; preservar o demo atrás de uma chave).
5. Ajustar estabilidade medindo no notebook + empacotar o `.exe`. Soak test antes da pista.

## Definição de CONCLUÍDO

- `.exe` abre no notebook, lê Injepro e RaceBox localmente, mostra o painel com dado real;
- religa sozinho após queda de USB e de Bluetooth;
- passa o teste de horas seguidas sem travar;
- números do motor batem com o software oficial Injepro;
- aprovação visual do Flávio + posição no mapa conferida na pista.

## O que já foi preparado no Mac (antes da sessão Windows)

(Preencher conforme entregue: leitor BLE do GPS, religação automática, tradutor do motor
portado do site, fiação da tela ao dado real.)
