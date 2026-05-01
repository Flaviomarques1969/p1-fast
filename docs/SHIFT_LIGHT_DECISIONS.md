# Smart Shift Light Premium — Decisões de produto

Decididas em conversa com Flávio em 2026-05-01. Cada decisão tem opções avaliadas e a escolha final. Servem de referência pra implementação.

## Princípios inegociáveis (da spec original)

1. **Visual-only durante pilotagem** — capacete + escapamento + mãos no volante = sem áudio, sem toque. Tudo pelo olho periférico.
2. **Não fabricar dados** — se não tem dyno, não inventa curva. "Sem referência" é estado válido.
3. **Foco do app é trecho, não volta** — eventos e análises ancoram em `trecho_id`.
4. **Mockup primeiro** — `_design-reference/*.html` é fonte da verdade visual. Implementação respeita o mockup, não o contrário.
5. **Cockpit minimalista durante pilotagem** — sem texto, RPM, marcha, delta. Só o pulso visual.
6. **Análise técnica só após o carro parar** — cards de pós-sessão, nunca durante a volta.

---

## Card 1 — Trecho da pista: fonte do dado

**Escolha: A** — Reusa o sistema de trecho que já existe no P1 Fast.

Cada `shift_event` carrega `trecho_id`. O sistema resolve o trecho pelo GPS no instante da troca, usando a infra existente (mesma usada por stint, comparações, vista de volta).

**Implicação técnica:** Bloco 3 inclui `trecho-resolver.js` que consulta o serviço de trecho do app principal.

---

## Card 2 — Cadastro do dinamômetro: onde fica

**Escolha: A + D combinado** — UI de cadastro **dentro do carro** (`mockup-carro-novo.html` extendido) com **upload de CSV** (Dynojet/Mustang/Dynapack) + entrada manual de pontos como fallback.

**Implicação técnica:** Bloco 6 estende o mockup do carro, parser de CSV multi-formato, preview da curva, validação de campos mínimos (RPM, torque ou potência).

---

## Card 3 — Quando o FIRE dispara

**Escolha: C** — Configurável por sessão. No início de cada sessão, piloto escolhe modo:

- **Modo Aprendizado** — barra exibe só a subida verde/amarelo/vermelho. Sistema coleta dados mas não dispara FIRE. Piloto troca no feeling.
- **Modo Assistido** — barra completa: subida + FIRE + overrev. Só faz sentido com confiança ≥ 0.7 e alvo válido (DYNO_CALIBRATED ou TELEMETRY_LEARNED com ≥ N amostras).

**Implicação técnica:** UI de início de sessão tem toggle. `shift-light` no cockpit consulta esse toggle. Se modo assistido + sem alvo confiável, sistema cai pra modo aprendizado automaticamente E mostra mensagem grave informando.

---

## Card 4 — Tolerância do delta (verde/vermelho)

**Escolha: B + C combinado** — Auto-calculada pelo dyno quando disponível, configurável por carro como fallback (default ±150 rpm).

Regra:
- Com dyno → tolerância = X% da janela útil do motor (X ~ 5%, parametrizável).
- Sem dyno → tolerância configurada no cadastro do carro (default ±150).

**Implicação técnica:** `cars.js` ganha campo `tolerance_rpm`. `shift-target.js` ou `shift-analysis.js` decide qual usar baseado em presença de curva dyno.

---

## Card 5 — Telemetry chip: qual sensor está em warn

**Escolha: C** — Mensagem grave no slot direito + chip pisca pra direcionar olhar.

Princípio derivado: **durante a corrida, piloto não toca na tela**. Toda interação requer parar. Tooltip não serve.

Comportamento:
- Sensor em warn (degradado): dot amarelo, sem alerta. Piloto vê quando puder.
- Sensor crítico (caiu / perda total): dot cinza/vermelho + chip inteiro pisca + mensagem grave no slot direito ("GPS perdeu sinal", "Injepro desconectou", etc.).
- Resolução de qual sensor: tela de diagnóstico separada, acessível só no box.

**Implicação técnica:** chip ganha animação `is-alert` (pisca). `alert-bloco grave` reusado pra disparo. Tela de diagnóstico fica em backlog (não bloqueia entrega).

---

## Card 6 — Ordem de implementação

**Escolha: A** — ordem original, do fundamento ao premium:

1. Estimativa de marcha + confiança
2. Modo seguro + alvo conservador
3. Detecção de evento de troca + persistência (com `trecho_id`)
4. Cards pós-sessão (Fast Coach feedback)
5. Pilot Reaction Learning (após N trocas registradas)
6. DYNO_CALIBRATED + UI de cadastro (CSV) + tolerância auto-calculada

**Lógica:** após Bloco 4 já há valor entregue (sessão gera análise útil). Blocos 5 e 6 são premium tier — chegam depois.
