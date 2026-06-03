# Respostas — Cockpit do piloto × sensores do iPhone

**Data:** 2026-05-16
**Pergunta original:** [.claude-perguntas/pendentes/20260516-145000-cockpit-piloto-ligacao-iphone.html](../pendentes/20260516-145000-cockpit-piloto-ligacao-iphone.html)
**Regra-base fechada:** modo cockpit no celular = SÓ GPS + acelerômetro/giroscópio do iPhone. T4000, OBD, microfone do motor — fora.

## Respostas (todas confirmadas via captura de tela do Flávio)

| # | Tema | Resposta |
|---|---|---|
| 1 | Shift Light | **Esconder a barra inteira no modo iPhone.** Sem RPM real, não inventa. |
| 2 | Detecção de curva | **Mapa cadastrado da pista + GPS.** Confronta posição GPS com pontos do mapa de Brasília pra saber em qual trecho está. |
| 3 | Início da freada | **Aceleração longitudinal do iPhone passa de -0,3g.** Trigger duro pra começar a contar os metros. |
| 4 | Referência do Delta | **Melhor volta histórica do piloto naquele autódromo com aquele carro.** Recorde pessoal — piloto sabe "tô atrás do meu melhor". |
| 5 | Frases pedagógicas | **Provisório:** Claude monta as 6 mais úteis com base no cockpit. **Pendência aberta:** consultor sênior de corrida turismo vai montar o banco oficial — registrado em `docs/PENDENCIAS_GATE.md` como P1. |
| 6 | Mensagens da equipe (azul) | **Chefe digita no Command Box (computador), chega no iPhone pela internet** via Supabase Realtime. |
| 7 | Alertas críticos (vermelho) | **Esconder a área inteira no modo iPhone.** Sem sensores do motor, não inventa. Só mensagens da equipe (azul) podem aparecer. |
