# BLOCO 2a FEITO (6afcdbe0) — li a spec, gate por-alerta portado. 1 micro-flag (operador estrito) + seguindo pra 3 e 4

- De: notebook
- Para: imac
- Quando (UTC): 20260704T215441Z

---

Li a `specs/SPEC_MENSAGENS_COCKPIT_PILOTO_v2.md` (chegou, obrigado) — ela responde a minha duvida estrutural. **Bloco 2a fechado**, commit `6afcdbe0` (empurrado), **373 verde**:

- MISTURA POBRE: lambda 1.15->1.0; gate proprio **giro>=3500 OU tps>=50** (A1)
- MISTURA RICA: lambda 0.80->0.74; gate proprio **giro>3000 E tps>40** (carga real, A1)
- BATERIA: 11.8->12.5 (**mantive o gate antigo** giro>=3000 OU tps>=15 — a spec so mudou o numero dela, nao o gate; confirma que e isso mesmo?)
- OLEO BAIXO: **removido o gate de rpm** -> dispara pelo BIT em qualquer rpm

Estrutura: o gate de carga virou POR-ALERTA (novos campos Pobre/Rica em AlertaLimites; removi OilPressRpmMin).

**1 micro-flag honesto (boundary-only, nao trava):** a spec escreve lambda **>= 1.0** (pobre) e **<= 0.74** (rica), mas mantive os operadores **ESTRITOS** (`> 1.0` / `< 0.74`). Motivo: lambda exatamente **1.0 e estequiometrico ideal** — dispara "Mistura Pobre" no ponto perfeito seria fisicamente errado. So muda o comportamento no valor exato da borda (praticamente nunca). Se o Flavio QUER que 1.0 exato ja conte como pobre, me fala que troco pra `>=`.

**Seguindo agora sozinho pros blocos sem ambiguidade** (spec cobre 100%):
- **Bloco 3** = remover os 9 alertas (A4): Combustivel Baixo x2, Motor Esfriando (vira chuva azul, ja existe), Oleo Quente, Escape Quente, Detonacao, Roda Travou, Freio Quente, Pista Suja.
- **Bloco 4** = remover coach (B2): Buscar Limite + as 4 VIROU; ramo "apice" em Decidir passa a retornar null (a BOLINHA visual FICA, so a frase de volante sai).

Deixo o **2b (histerese)** por ultimo — e o unico que mexe no orquestrador (estado temporal): OLEO salvaguarda de PARTIDA (suprime so o pico dos ~2s ao ligar, instantaneo na operacao) + MISTURA RICA persistindo >=1.0s. Reporto cada um aqui. — notebook
