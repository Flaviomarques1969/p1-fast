# SPEC — MENSAGENS DO COCKPIT DO PILOTO v2 (simplificação Flávio, 2026-07-04)

> Fonte de verdade das mensagens do cockpit do piloto após a revisão total do Flávio (04/07).
> Decisões cruas em `P1 Fast/.claude-exec/DECISOES-MENSAGENS-PILOTO-2026-07-04.md` (lado iMac).
> Alvo de implementação: **notebook** — `AlertasCriticos.cs` e `DeltaCoach.cs` do `.exe` + fonte-da-verdade §4/§9/§12.
> iMac coordena; nada de produção; tela aprovada só muda comportamento já decidido (modo crítico já existe).

De **38 mensagens → ficam 24** (14 removidas). Duas fases: FASE 1 = parâmetro/texto/remoção (rápido).
FASE 2 = regras por IA de padrão histórico (projeto de cérebro).

---

## REGRA GERAL — MODO CRÍTICO (já existe no .exe, gap 6)
Toda mensagem de gravidade **crítica/super** = **apaga o painel** (delta, ápice, frenagem, luzes somem) e
mostra **só a mensagem grande piscando devagar** + borda periférica. Confirmado pelo Flávio como padrão de TODA crítica.

---

## BLOCO A — ALERTAS DO CARRO

### A1. FICAM E FUNCIONAM HOJE (motor/injeção via USB) — FASE 1
| Mensagem (texto novo) | Era | Gravidade | Regra / parâmetro | Muda o quê |
|---|---|---|---|---|
| **Motor Quente** | MOTOR QUENTE | Super (modo crítico) | água ≥ **70°C** | texto + número (era 80) |
| **Óleo Baixo** | ÓLEO BAIXO | Super (modo crítico) | bit de baixa pressão de óleo em **qualquer rpm** (remove o >2000) | tira o gate de rpm |
| **Mistura Pobre** | MISTURA POBRE | Crítico | lambda ≥ **1.0**, sob carga: giro ≥ **3500** E/OU acelerador ≥ **50%** (leitura plausível 0.3–1.6) | 3 números |
| **Mistura Rica** | MISTURA RICA | Atenção | lambda ≤ **0.74**, sob carga: giro > **3000** E acelerador > **40%**, **persistindo ≥ 1.0s** | número + histerese nova |
| **Falha Cilindros** | FALHANDO | **Crítico** (subiu de Atenção) | cilindros desbalanceados (bit) | texto + gravidade |
| **Bateria** | BATERIA | Atenção | tensão < **12.5V**, sob carga | número (era 11.8) |
| **Desconectou** | SEM DADOS | Crítico | aparelho do motor perde comunicação (evento) | texto |
| **BOX** | BOX | Info | equipe chama (manual) | — mantém |
| **Última Volta** | ÚLTIMA VOLTA | Info | última volta planejada; **sem prioridade**, mostrar **antes de entrar no cool down** | comportamento |
| **Sem GPS** | SEM GPS | Info | sinal do **RaceBox** falha (não iPhone) | fonte corrigida |

**Nota técnica honesta (Óleo Baixo, qualquer rpm):** na partida/parado a pressão sobe em 1–2s; alertar a 0 rpm pode piscar
falso na largada. Recomendo **histerese curta SÓ na janela de partida** (suprime o pico dos primeiros ~2s ao ligar/rpm subindo do zero;
durante a operação normal é **instantâneo**, sem atraso). Assim não dá falso na largada e não atrasa alarme real na pista.
Decisão do Flávio é "qualquer rpm avisa" — a histerese de partida não muda a intenção. **iMac vai avisar o Flávio dessa salvaguarda.**

### A2. FICAM, MAS ESPERAM SENSOR NO CARRO (latentes) — FASE 2 (regra) + hardware
| Mensagem | Gravidade | Regra | Observação |
|---|---|---|---|
| **Pneu Quente** | Super | 1 campo → **105°C**. Se der 2 níveis: radial 185 = atenção **95** / crítico **105**; semi-slick 195 = atenção **105** / crítico **115** | sensor de pneu a instalar |
| **Pneu Aquecendo** | Atenção (Flávio: "muito importante") | **IA de padrão**: aprende temp normal do pneu (média/máx/mín, carro andando); avisa quando muda o comportamento (prevê furo/dano de estrutura) | sensor a instalar |
| **Pressão Pneu** | Atenção | **IA de padrão**: aprende a pressão média do pneu; avisa quando **cai** a partir da média | sensor a instalar (o card não tinha limite; agora tem regra) |
| **Câmbio Quente** | Super | câmbio > **140°C** | sensor a instalar (Flávio não reprovou; mantido por coerência com Câmbio Aquecendo) |
| **Câmbio Aquecendo** | Atenção | manter no catálogo | Flávio: "mantenha" |

### A3. TEMPERATURA DO MOTOR — VIRA IA (FASE 2)
| Mensagem (texto novo) | Era | Gravidade | Regra nova |
|---|---|---|---|
| **Temperatura Motor Subindo** | MOTOR AQUECENDO | Atenção (preventivo, **não** toma a tela) | **IA de padrão histórico**, NÃO valor fixo de 70. Aprende a temp normal do carro (temp externa + histórico do motor, média/máx). Avisa quando a temperatura **sobe fora do padrão de forma consistente** (ex.: normal 55, máx 57 → bater 60–63 subindo = avisa). Casa com `deteccao_por_padrao_historico` (3 voltas, desvio). **Na FASE 1 o gatilho fixo de 70 SAI de cena (não há regra fixa); volta como IA na FASE 2.** |

> Motor Quente (A1, água ≥70 crítico) e Temperatura Subindo (IA, avisa antes) não colidem: um é o teto de segurança, o outro é o aviso preventivo antes. Como o QUENTE cai pra 70, o SUBINDO não pode ter gatilho fixo em 70 (colidiria) — por isso ele só existe como IA na Fase 2.

### A4. SAEM DO CATÁLOGO (14 no total; 9 alertas) — FASE 1
- **Combustível Baixo (urgente)** e **Combustível Baixo (leve)** — sem medição de combustível na injeção; nunca teriam base real.
- **Motor Esfriando** — vira a **chuva térmica azul/fria** (já existe, §12).
- **Óleo Quente** — sem sensor de temperatura de óleo.
- **Escape Quente** — sem sonda de escape (Flávio confirmou: foi engano marcar manter).
- **Detonação** — sem sensor de detonação.
- **Roda Travou** — sem dado de freio/roda.
- **Freio Quente** — sem sensor de freio.
- **Pista Suja** — futuro possível só via GPS; fora por ora.

---

## BLOCO B — FRASES DO COACH

### B1. FICAM — FASE 1
| Mensagem (texto novo) | Era | Regra (inalterada) |
|---|---|---|
| **Coletando Dados** | REGISTRANDO | 1ª passagem / sem referência |
| **Recorde** | RECORDE | ganho ≥ 0.10s e bateu recorde histórico |
| **Melhor Stint** | MELHOR STINT | ganhou e bateu o melhor da sessão |
| **Manteve Linha** | MANTEVE LINHA | ganho pequeno (até 0.15s) |
| **Freou Cedo** | FREOU CEDO | perdeu no freio, entrada normal |
| **Freou Tarde** | FREOU TARDE | perdeu no freio, chegou rápido na entrada |
| **Acelere Mais** | PISOU POUCO | perdeu na entrada (vira **instrução**, não diagnóstico) |
| **Acelerou Tarde** | ACELEROU TARDE | perdeu na saída |

### B2. SAEM — FASE 1
- **Buscar Limite** — Flávio tirou.
- **Virou Cedo / Virou Pouco / Virou Tarde / Virou Muito** — as quatro saem. **Sem mensagem de volante**: o piloto corrige seguindo a **bolinha do ápice** (que já mostra a direção). Confirmado 04/07.

> **IMPORTANTE — não confundir:** a **bolinha do ápice (gap 5, visual)** que o notebook fez **FICA** (Flávio re-aprovou). O que sai é só a **frase** de volante. Efeito no código: em `DeltaCoach.Decidir`, o ramo `"apice" => ClassificarApice(...)` deixa de emitir frase (retorna null/sem mensagem); some `ClassificarApice` e as 4 constantes VIROU + `BuscarLimite`. O ramo do ápice fica coberto só pela bolinha (visual).

---

## CONTAGEM FINAL
- **Alertas do carro:** ficam **16** (10 ativos/manuais + 5 latentes + 1 IA de temperatura), saem **9**.
- **Coach:** ficam **8**, saem **5**.
- **Total: de 38 → 24.**

## O QUE É RÁPIDO x O QUE É PROJETO
- **FASE 1 (rápida, notebook):** todos os textos novos, os números (água 70, mistura, bateria 12.5, óleo sem gate rpm), subir gravidade da Falha, e todas as remoções. Isso já corta a bagunça e deixa a tela honesta.
  - **Bloco 1 = TEXTOS** (feito, commit d5493671).
  - **Bloco 2a = números secos** (mistura pobre 1.0/3500/50; mistura rica lambda 0.74/tps 40; bateria 12.5; óleo tira gate rpm) — sem estado temporal.
  - **Bloco 2b = histerese** (mistura rica duração ≥1.0s; óleo salvaguarda de partida ~2s) — lógica de estado temporal no orquestrador.
  - **Bloco 3 = remoções de alerta** (9). **Bloco 4 = remoções de coach** (Buscar Limite + 4 VIROU).
- **FASE 2 (projeto de cérebro):** IA de padrão histórico (Temperatura Subindo, Pneu Aquecendo, Pressão Pneu) e os 2 níveis do Pneu Quente. Depende de dado e, no caso do pneu/câmbio, de sensor no carro.

## PENDÊNCIAS DE HARDWARE (não bloqueiam a Fase 1)
Sensores de **pneu** (temp + pressão) e **câmbio** (temp) ainda não estão no carro. As mensagens A2 ficam latentes até instalar.

## CAIXA DO TEXTO (padronização — pendente do Flávio)
Só as 6 mensagens que o Flávio reescreveu viraram Title Case ("Motor Quente"); o resto segue em CAIXA ALTA. Definir se padroniza tudo depois (iMac leva ao Flávio).
