# Checklist do dia de pista — P1 Fast

> Criado 2026-06-09, depois da validação no escritório da solução completa
> (carro + GPS + câmera + nuvem). Atualizar sempre que a solução mudar.

## O que levar

- Notebook Samsung Windows (carregado + carregador).
- Starlink (internet da pista).
- **T4000**: cabo USB dela → notebook.
- **RaceBox Mini S** (GPS): carregado. Dados vão por **Bluetooth** — o cabo USB-C dele é SÓ
  carga, pode ficar num carregador. NÃO ocupa porta do notebook.
- **DJI Osmo Action 6** (câmera): cabo USB → notebook (vira webcam). Carregada.
- iPhone (pra assistir de fora e pro app).

## Posição dos aparelhos no carro

- **RaceBox**: com vista do céu — painel junto ao para-brisa OU teto externo.
  NUNCA debaixo de metal/teto (bloqueia 100% o GPS — provado em 09/06).
- **DJI**: apontada pra frente (visão do piloto).
- Notebook: porta USB 1 = T4000 · porta USB 2 = DJI · Bluetooth = RaceBox.

## Ligar, nesta ordem (notebook, navegador Edge ou Chrome)

1. Starlink no ar → notebook conectado na internet.
2. **Aba 1 — Painel do piloto:** abrir `p1t4000.vercel.app`
   → clicar **"Autorizar T3000 via WebUSB"** → escolher a Injepro na lista.
   Conferir: status "conectado — lendo a T3000" + "nuvem: ao vivo".
3. **Aba 2 — Central de Pista:** abrir `p1tv.vercel.app`
   → **"Iniciar transmissão"** (escolher a DJI no seletor de câmera)
   → **"Conectar RaceBox por Bluetooth"** (escolher "RaceBox Mini S …").
4. Conferir o quadro de 4 luzes no topo da Central:
   - **VÍDEO · no ar ✓**
   - **GPS · travado ✓** (com nº de satélites; "sem céu" = reposicionar o RaceBox)
   - **CARRO · ao vivo ✓** (vem da Aba 1; se "sem dados", a Aba 1 não está lendo)
   - **NUVEM · ao vivo ✓**
5. No celular de quem acompanha: abrir `p1tv.vercel.app/painel` (vídeo + GPS + dados
   do carro) — ou a tela ao vivo do app P1 Fast.

## O que se recupera SOZINHO (não precisa mexer)

- Internet oscilou → vídeo e nuvem religam sozinhos (até 15 s entre tentativas).
- RaceBox desligou/voltou → religa sozinho.
- Cabo da T4000 mexeu/voltou → o painel religa sozinho (mostra "religando…" enquanto isso).
- Se uma luz ficar vermelha por mais de ~1 minuto, aí sim agir (ver plano B).

## Plano B de cada peça

| Peça caiu | O que fazer |
|---|---|
| Vídeo (DJI) | Conferir cabo USB da DJI; recarregar a página da Central. O resto continua funcionando sem vídeo. |
| GPS (RaceBox) | Conferir carga/posição com vista do céu; botão "Conectar RaceBox" de novo. |
| Dados do carro | Aba 1: recarregar página + "Autorizar T3000" de novo; conferir cabo USB da T4000. |
| Nuvem (Starlink) | Tudo local continua (painel do piloto na Aba 1 não depende de internet). Quem está fora fica sem ver até voltar. |
| Notebook reiniciou | Refazer "Ligar, nesta ordem" — leva ~2 minutos. |

## Teste sem o carro (escritório / véspera)

Na Central de Pista (`p1tv.vercel.app`), botão **"Simular carro (gravação real do motor)"**:
toca a gravação real do motor do Bubi (26/05, 2.901 amostras) na nuvem. Serve pra testar
painel remoto, app e ouvintes sem ligar o carro. O simulador desliga sozinho se o carro
REAL começar a mandar dados (não mistura).
