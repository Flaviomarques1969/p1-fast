# Teste de amanhã — Fase 1 do Cockpit do Piloto (caminhada de 15 min)

**Data:** 2026-05-17
**Versão entregue:** rodada C (C1 + C2 + C3) — 2026-05-16 noite
**Aplicativo já instalado no seu iPhone Pro Max (7).**

---

## O que você vai validar em 15 minutos a pé

O cockpit do piloto agora recebe dados ao vivo do GPS + acelerômetro do iPhone. Você vai conferir se um dos quatro números (ENTRADA km/h) reage quando você se move.

Não precisa de carro. Não precisa de pista. Não precisa de internet. Só você, o iPhone, e um trecho de calçada.

---

## Passo a passo

### 1. Preparar o aplicativo (1 min)

1. Pegue o iPhone Pro Max (7) — o aplicativo "p1fast" já está instalado e atualizado.
2. **Tire o iPhone do bolso** (precisa pegar GPS — sinal fraco dentro do bolso).
3. **Saia da garagem ou de qualquer lugar coberto** (GPS precisa de céu aberto). Ponto livre na frente de casa ou na calçada serve.
4. Abra o aplicativo.

### 2. Iniciar um stint de teste (2 min)

1. Toque em **Eventos** (no menu de baixo).
2. Toque em qualquer evento já criado, ou crie um novo (Carro Celta · Brasília · qualquer data).
3. Toque em **Iniciar stint** (botão grande).
4. A tela vai **virar pra horizontal sozinha** e mostrar o cockpit (mapa de Brasília + 4 quadradinhos no canto direito: Entrada, Freio, Ápice, Saída).

### 3. Conferir que o cockpit entrou enquadrado (30 s)

O cockpit deve aparecer:
- Tela toda escura ao redor.
- Mapa de Brasília visível no centro/esquerda.
- Os 4 quadradinhos do lado direito mostrando **"—"** nos quatro (Entrada, Freio, Ápice, Saída).
- **NÃO** deve aparecer: barra colorida embaixo (stint bar), número 0.42 verde/vermelho (delta), frase "FREIE TARDE", mensagem azul "Pneu DD acima da janela", flash branco-azul.

Se aparecer alguma dessas coisas escondidas, anota e me conta.

### 4. Teste da Fase 1 — o número ENTRADA reagindo (10 min)

Esse é o teste. Foco no quadradinho **ENTRADA** (primeiro do lado direito).

#### Cenário A — parado em pé
1. Fique parado em pé, segurando o iPhone na horizontal.
2. Aguarde uns 10 segundos (o GPS precisa pegar sinal).
3. **ENTRADA deve mostrar 0 ou um número muito baixo (0–3 km/h).**
4. Se ficar muito tempo em "—", significa que o GPS ainda não pegou — espere mais 10–20 s. Se passar de 1 minuto, anota.

#### Cenário B — andando devagar
1. Comece a andar normalmente (passo de caminhada — sem correr).
2. **ENTRADA deve subir pra 4–6 km/h.**

#### Cenário C — andando rápido / trotando
1. Acelere o passo, quase trotando.
2. **ENTRADA deve subir pra 7–12 km/h.**

#### Cenário D — parar de novo
1. Pare bruscamente.
2. **ENTRADA deve voltar pra perto de 0 em 1–2 segundos.**

### 5. Se algo deu errado

Se você quiser sair sem encerrar:
- Toque **3 vezes seguidas** no canto superior direito da tela (a parte sem nada).
- Vai aparecer o painel escondido com botões de ajuste + botão **ENCERRAR STINT** + **Cancelar (sem encerrar)**.
- Toque em "Cancelar (sem encerrar)" pra sair sem fechar o stint.

Se a tela ficou desenquadrada (ex: cockpit fora do lugar):
- Mesmo toque triplo abre o painel de ajuste com setas e zoom.
- Use ← → ↑ ↓ pra mover, + − pra zoom, ↺ pra resetar, **salvar** pra persistir.

---

## O que pode dar errado — e o que isso significa

| Sintoma | Significa | O que fazer |
|---|---|---|
| ENTRADA fica em "—" por mais de 1 minuto parado a céu aberto | GPS não pegou sinal. | Caminhe mais alguns metros, troque de lado da rua. Se persistir, me avisa. |
| ENTRADA fica em 0 mesmo andando rápido | Ponte JS↔Swift falhou (ou GPS travou). | Encerre o stint pelo toque triplo, abra de novo. Se persistir, me avisa. |
| ENTRADA mostra valores absurdos (200 km/h andando, valores negativos) | Bug de cálculo ou ruído do GPS. | Anota o valor e me avisa. |
| ÁPICE, SAÍDA ou FREIO mudam de valor (não ficam em "—") | Detector de trecho disparou — não deveria sem você estar dirigindo numa pista. Pode ser que o GPS pulou pra dentro da geometria da pista de Brasília acidentalmente. | Anota e me avisa. |
| Tela não vira pra horizontal | Travamento de orientação. | Reabra o aplicativo. |
| Cockpit desenquadrado (cortado, fora do meio) | Calibração precisa de ajuste. | Use o painel de ajuste (toque triplo no canto superior direito) e ajuste com setas e zoom, depois **salvar**. |

---

## O que você NÃO está testando hoje

- ÁPICE, SAÍDA, FREIO reagindo — isso é a Fase 2 (carro de verdade em rua, depois Fase 3 na pista).
- Delta de tempo (0.42 verde/vermelho) — depende de banco de melhor volta (rodada F, ainda não construída).
- Frase pedagógica (FREIE TARDE) — depende de frases oficiais do consultor sênior (rodada G).
- Stint bar colorida — depende de histórico de voltas (rodada F).
- Mensagem azul da equipe — depende de internet + Command Box (rodada H).
- Encerramento automático nos boxes — depende de cadastro de pista com zona de boxes (rodada D/E).

---

## Quando você terminar

Me manda:
- "ENTRADA reagiu certo nos 4 cenários" → Fase 1 fechada, posso preparar Fase 2 (carro em rua).
- "ENTRADA não reagiu / reagiu errado em algum cenário" → me conta qual cenário e o que viu. Eu volto a olhar a ponte.
- Foto da tela se algum sintoma do quadro acima aparecer.

---

## Estado técnico do iPhone agora (registro)

- **Aplicativo:** `com.flaviomarques.p1fast` instalado e lançado em 2026-05-16 21:53 (devicectl).
- **Identificador do dispositivo:** `2D6E7A3B-1449-5BE6-8D82-18F969ED0CCB` (iPhone 16 Pro Max, iOS).
- **Cockpit HTML embutido:** assinatura `408a5b1f…` (igual ao canônico em `_design-reference/`).
- **Build:** Debug, configuração `arm64-apple-ios17.0`.
- **Pista de Brasília:** seed automático no `TrackRepository.bootstrap()` — entra na primeira vez que o aplicativo abre.

---

## Limitação honesta da entrega da rodada C

Eu **NÃO consegui tirar uma captura de tela do iPhone** depois de instalar (ferramenta `idevicescreenshot` perdeu o pareamento legado — só o pareamento novo, do Xcode, está ativo). Confirmei via comando de instalação que o aplicativo subiu e abriu, mas a **validação visual da Fase 1 fica pra você amanhã**.
