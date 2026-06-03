# Cockpit do piloto no celular — plano da Rodada C

**Versão:** 1 · **Data:** 2026-05-16 noite · **Status:** aguardando aprovação de Flávio
**Cenário:** Modo Celular — iPhone único no carro, sem T4000, sem OBD, sem cabos. Todos os dados vêm de GPS + acelerômetro + giroscópio do próprio iPhone.

---

## 1. O que esta rodada entrega (visão de produto)

No fim da Rodada C, **o cockpit do piloto reage em tempo real ao movimento do iPhone**. Quatro campos do cockpit deixam de ser "decoração de mockup" e passam a mostrar o que o sensor está medindo de fato:

1. **ENTRADA km/h** — velocidade na entrada da curva atual.
2. **ÁPICE km/h** — menor velocidade alcançada dentro da curva.
3. **SAÍDA km/h** — velocidade no instante em que sai da curva.
4. **FREIO m** — distância em metros que o piloto freou antes da curva.

Os outros campos (delta de tempo, frase pedagógica, faixa colorida de stint, mensagem da equipe, halo de fundo) **ficam mostrando "—"** porque dependem de banco de melhor volta histórica, frases oficiais e Realtime da equipe — pendências das rodadas F, G e H.

---

## 2. Como vai funcionar por dentro (sem jargão)

O aplicativo já mede sensores hoje. O que falta é uma **ponte** entre dois lados:

- **Lado do aplicativo** (Swift) — sabe a velocidade, a aceleração, o trecho da pista, etc. já em memória.
- **Lado do desenho do cockpit** (HTML/JavaScript) — sabe desenhar números bonitos na tela, mas hoje só mostra valores chumbados.

A ponte é uma "linha telefônica" entre os dois lados. Quando o Swift mede um valor, ele "telefona" pra página do cockpit dizendo "olha, ENTRADA agora é 92". A página atualiza o número visível.

A ponte funciona nos dois sentidos: o cockpit também pode "telefonar" de volta pro Swift se precisar (por exemplo, num futuro: clique em algo).

---

## 3. Mapa de dados — os 9 campos do cockpit e suas origens

| # | Campo no cockpit | O que mostra | Sensor de origem | Regra de cálculo | Sub-etapa |
|---|---|---|---|---|---|
| 1 | **ENTRADA km/h** | Velocidade na entrada da curva | GPS (com Kalman, 10x por segundo) | Quando o detector de trecho diz "entrei numa curva", congela a velocidade daquele instante | C2 |
| 2 | **FREIO m / m** | Distância de freio: atual / referência | Acelerômetro (longitudinal) + GPS | Detecta freada quando aceleração passa de −0,3g. A distância é integral da velocidade do início da freada até o ápice. Referência vem da melhor volta histórica | C2 (atual) · F (referência) |
| 3 | **ÁPICE km/h** | Menor velocidade dentro da curva | GPS | Mínimo da velocidade enquanto o trecho atual é "ápice da curva" | C2 |
| 4 | **SAÍDA km/h** | Velocidade no fim da curva | GPS | Velocidade no instante em que o detector de trecho muda de "ápice" pra "saída" | C2 |
| 5 | **Delta acumulado** (ex: 0.42) | Diferença em segundos vs sua melhor volta | Cronômetro acumulado | Diferença em tempo entre minha passagem atual neste trecho e o tempo do mesmo trecho na minha melhor volta histórica | **Rodada F** |
| 6 | **Frase pedagógica** (ex: "FREIE TARDE") | Conselho de pilotagem | Regra baseada no delta + freio | Se freou tarde demais → "FREIE ANTES". Se passou rápido no ápice → "ÁPICE TARDE". Etc. | **Rodada G** (6 frases provisórias até consultor sênior) |
| 7 | **Stint bar** (faixa colorida embaixo) | Comparação volta-a-volta deste stint | Histórico do banco local | Cada bloquinho representa uma volta deste stint. Verde = mais rápida que média, Vermelho = mais lenta, Branco = atual, Laranja = melhor do stint | **Rodada F** |
| 8 | **Mensagem azul** (ex: "Pneu DD acima da janela") | Recado do chefe pela internet | Realtime do Supabase | Quando o chefe digita no Command Box (computador), chega no iPhone | **Rodada H** |
| 9 | **Halo de fundo** (laranja/roxo) | Cor de fundo conforme o trecho | Comparação automática | Laranja: recorde deste stint. Roxo: pior do stint. Sem cor: normal | **Rodada F** |

---

## 4. Subdivisão em C1, C2, C3

### Sub-etapa C1 — Construir a ponte + ENTRADA reagindo (estimativa: 1 hora)

**Objetivo:** ver pela primeira vez um número do cockpit mudando conforme o iPhone se mexe.

**O que vou construir:**
- A ponte Swift ↔ JavaScript no aplicativo.
- Quando o GPS reportar uma nova velocidade, o aplicativo envia pro cockpit.
- Conecta apenas o campo **ENTRADA km/h** = velocidade atual em tempo real (sem se preocupar com qual trecho está — só velocidade do iPhone naquele instante).
- Os outros campos continuam congelados (placeholders do mockup).

**Critério de aceite (Fase 1 de teste, a pé):**
1. Abro o cockpit no iPhone.
2. Paro de pé: ENTRADA mostra "0" ou um número muito baixo.
3. Saio andando normalmente: ENTRADA passa pra ~5 km/h.
4. Corro: ENTRADA passa pra ~10–15 km/h.
5. Paro: ENTRADA volta a zerar.

Se isso funciona, C1 está fechada.

---

### Sub-etapa C2 — Detector de trecho + 4 velocidades por trecho (estimativa: 2 horas)

**Objetivo:** os 4 campos de velocidade (ENTRADA, ÁPICE, SAÍDA, FREIO) reagindo certo dependendo de QUAL trecho da pista o carro está.

**O que vou construir:**
- Carregar o **mapa do Autódromo de Brasília** (já cadastrado nas memórias do projeto) ao iniciar o stint.
- Ativar o **detector de trecho** que já existe no núcleo do aplicativo (LiveDetectorBridge / LiveKalmanProcessor).
- Quando o detector troca de trecho (ex: "entrei na curva 7"), o aplicativo:
  - Congela **ENTRADA** com a velocidade daquele instante.
  - Começa a observar **mínimo de velocidade** pra preencher **ÁPICE** ao sair.
  - Marca **SAÍDA** quando troca pro próximo trecho.
- Adicionar detector de freio (acelerômetro longitudinal < −0,3g) que ativa o cronômetro de **FREIO m** até a ENTRADA da curva.

**Critério de aceite (Fase 2 de teste, de carro em rua):**
1. Você dirige na rua segurando o iPhone preso ao painel.
2. Acelera reto, depois freia bruscamente: FREIO m mostra alguma distância.
3. Faz uma curva: ENTRADA, ÁPICE e SAÍDA preenchem na ordem certa, com valores que fazem sentido.
4. Os 4 campos batem aproximadamente com o que você sente no carro real.

Se isso funciona, C2 está fechada.

---

### Sub-etapa C3 — Limpar o que ainda não tem dado real (estimativa: 30 min)

**Objetivo:** cockpit honesto. Campo só mostra valor se tem dado real. Campos sem origem ficam vazios.

**O que vou fazer:**
- **Delta acumulado** (0.42) → mostra `—`. Volta a ter valor na Rodada F (banco de melhor volta histórica).
- **Frase pedagógica** (FREIE TARDE) → escondida. Volta na Rodada G (6 frases provisórias).
- **Stint bar** (faixa colorida) → blocos todos cinza/neutros. Volta na Rodada F (histórico de voltas).
- **Mensagem azul** (Pneu DD) → escondida. Volta na Rodada H (Realtime).
- **Halo de fundo** → sempre neutro. Volta na Rodada F.

**Critério de aceite:**
- Olhando o cockpit estático, só os 4 campos reais (ENTRADA, FREIO, ÁPICE, SAÍDA) mostram valores. Resto fica vazio ou neutro.
- Nada parece "decoração de mockup".

---

## 5. Plano de teste — três fases

| Fase | Onde | Quanto tempo | O que valida |
|---|---|---|---|
| **Fase 1** (após C1) | Em casa, andando a pé | 15 minutos | A ponte entre aplicativo e cockpit funciona. Velocidade do GPS chega ao cockpit em tempo real. |
| **Fase 2** (após C2) | Num quarteirão de rua, com iPhone no painel do carro | 1 hora | Detecção de freio funciona. Os 4 campos reagem coerentemente. Latência aceitável (cockpit não atrasa em relação ao que você sente). |
| **Fase 3** (todas as rodadas) | Autódromo de Brasília | meio-dia | Produto completo funcionando em ritmo real de pista. Detecção de trecho preciso. Comparação com melhor volta histórica. Encerramento automático nos boxes. |

---

## 6. O que NÃO entra na Rodada C

Pra deixar claro o escopo:

- **Mapa cadastrável de outras pistas** — Fase futura.
- **Zona de boxes no cadastro de mapa** — Decisão 2026-05-16 registrada, virá com rodada de "cadastro de pistas" (separada).
- **Encerramento automático do stint** — Decisão registrada, depende de C2 funcionando + zona de boxes cadastrada. Vai entrar na **Rodada D ou E**.
- **Banco de melhor volta histórica** — Rodada F.
- **Frases pedagógicas oficiais** — Rodada G (pendência P1 do consultor sênior).
- **Mensagens da equipe via internet** — Rodada H.
- **Flash branco-azul em mensagem crítica de verdade** — implementação na Rodada H quando Realtime entrar.

---

## 7. Riscos e limites conhecidos

1. **GPS no iPhone é 1 Hz** (uma medida por segundo). Pra suavizar e dar 10 medidas por segundo, já tem o filtro Kalman INS-GPS implementado (MS-2.7). Em curva fechada, a velocidade na entrada pode ter pequena defasagem se o trecho é muito curto.
2. **Acelerômetro não distingue freio de motor vs freio de pedal.** Detecção de freio aqui é "desaceleração longitudinal" — qualquer aceleração negativa < −0,3g entra. Suficiente pra modo celular.
3. **Detecção de trecho depende do mapa de Brasília estar cadastrado no aplicativo.** Já está nas memórias, mas vou verificar se está carregado no banco local antes de C2.
4. **No iPhone preso ao painel, o GPS pode demorar uns segundos pra "pegar" sinal** quando o carro sai da garagem. Cockpit pode mostrar valores estranhos nesse intervalo. Vou tratar mostrando "—" enquanto a qualidade do GPS estiver baixa.

---

## 8. Arquivos que vou tocar (referência técnica)

Não precisa ler isso — é só pra rastrear depois.

- `ios/p1fast-ios/Sources/Views/StintCockpitView.swift` (ponte JS↔Swift via `WKScriptMessageHandler`).
- `ios/p1fast-ios/Sources/Telemetry/CockpitDataBinder.swift` (criar — observa o `StintCaptureCoordinator` e empurra dados pra ponte).
- `_design-reference/mockup-cockpit-piloto.html` (NÃO MEXER — é o canônico). Toda atualização vai por injeção JavaScript de fora.
- Banco local: só leitura na rodada C; persistência fica pras rodadas F+.

---

## 9. Modo "execução em sequência" — comando "go" 2026-05-16 noite

Flávio escolheu rodar tudo em sequência, sem interrupção, pra chegar amanhã com o iPhone pronto pra testar.

### O que será executado SEM nova confirmação ao receber "go"

| Ordem | O que faço | Critério objetivo de conclusão (eu mesmo confiro) |
|---|---|---|
| 1 | **C1 — ponte de dados + ENTRADA em tempo real**: construir a "linha telefônica" entre o aplicativo e o desenho do cockpit, conectar a velocidade do GPS ao campo ENTRADA | Empacotamento passa sem erro · aplicativo instalado no iPhone · ao abrir o cockpit, a função de atualização existe na página · log do aplicativo mostra mensagens "ponte ligada" |
| 2 | **C2 — detector de trecho + 4 velocidades por trecho**: carregar mapa de Brasília, ligar detector de trecho, alimentar ENTRADA, ÁPICE, SAÍDA, FREIO conforme o trecho | Empacotamento passa · mapa de Brasília carrega sem erro · aplicativo instalado · detector de trecho ativo no iPhone · log mostra "detector iniciado, X trechos carregados" |
| 3 | **C3 — limpar campos sem dado real**: delta acumulado, frase pedagógica, stint bar, mensagem azul e halo viram "—" ou ficam escondidos enquanto não há dado real | Empacotamento passa · cockpit aberto no iPhone mostra só os 4 campos reais com placeholder inicial; resto neutro |
| 4 | **Auditoria interna**: rodar build novo, conferir empacotamento limpo, verificar arquivos no pacote, conferir SHAs, confirmar instalação | Build passa em modo Debug e Release · arquivo do cockpit dentro do pacote bate com canônico (assinatura `408a5b1f…`) · aplicativo rodando |
| 5 | **Criar instruções de teste pra amanhã** (`TESTE_AMANHA.md`) | Documento curto pronto explicando passo a passo o que você faz amanhã pra validar a Fase 1 (a pé) sozinho |
| 6 | **Atualizar memórias e checkpoint** | Memória reflete o estado final da rodada C |

### Limites honestos do que posso testar sozinho

**O que CONSIGO testar sem você:**
- Empacotamento sem erro.
- Instalação no iPhone.
- Aplicativo abre, cockpit abre, sem crash.
- A ponte JS↔Swift está montada (verifico chamando a função de teste pelo lado Swift).
- Mapa de Brasília carrega no banco local.
- Detector de trecho inicia (mas não dispara mudanças, porque o iPhone está parado).
- Os 5 campos "limpos" (C3) realmente ficam neutros.

**O que SÓ VOCÊ pode validar amanhã (porque depende de movimento real):**
- ENTRADA km/h mudar conforme você anda a pé.
- ÁPICE, SAÍDA, FREIO reagirem quando der uma volta de carro.
- Latência aceitável.
- Detector de trecho disparar nas curvas reais.

### O que vai estar pronto no iPhone amanhã

1. **Aplicativo instalado e atualizado** com toda a rodada C dentro.
2. **Cockpit do piloto** com:
   - Tela horizontal, enquadrada, modo celular (rodadas A e B preservadas).
   - 4 campos prontos pra reagir em tempo real: ENTRADA, ÁPICE, SAÍDA, FREIO.
   - 5 campos limpos: delta, frase, stint bar, mensagem da equipe, halo.
   - Painel de ajuste manual ainda disponível por toque triplo no canto superior direito.
3. **Documento `TESTE_AMANHA.md`** com instruções passo a passo pra você testar sozinho a Fase 1 (caminhada de 15 minutos).
4. **Documento atualizado de plano** com o que ficou pronto e o que ficou pendente.

### Riscos de executar em sequência

- **Build pode quebrar em alguma sub-etapa** (problema de código). Se acontecer, paro, conserto e sigo. No fim deixo a sessão registrada no documento dizendo o que travou.
- **Detector de trecho do Autódromo de Brasília pode não estar carregado no banco local.** Se não estiver, eu carrego (existe migração `0012_seed_brasilia`). Verifico antes de C2.
- **Não posso prever ajustes finos visuais** (cor de algum elemento, fonte). Se você não gostar de algo amanhã, ajustamos sem refazer rodada C inteira.

### O contrato

Você diz **"go"**. A partir desse instante:
1. Não te chamo até toda a sequência estar terminada ou um bloqueio impedir continuar.
2. No fim mando uma mensagem única dizendo:
   - O que ficou pronto (com SHAs e arquivos).
   - O que travou (se algo travou).
   - Onde está o `TESTE_AMANHA.md`.
   - Estado do iPhone (instalado, aberto, pronto).
3. Você dorme.
4. Amanhã abre, lê o documento, testa a pé, me diz o resultado.
