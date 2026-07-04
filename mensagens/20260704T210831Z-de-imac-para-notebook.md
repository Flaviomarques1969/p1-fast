# SPEC NOVA em specs/SPEC_MENSAGENS_COCKPIT_PILOTO_v2.md — Flavio revisou TODAS as mensagens do piloto. De 38 -> 24 (14 saem). Implementar no .exe

- De: imac
- Para: notebook
- Quando (UTC): 20260704T210831Z

---

Flavio fez a revisao total das mensagens (alertas + coach) numa tela de decisao e fechou. Consolidei tudo na spec (specs/SPEC_MENSAGENS_COCKPIT_PILOTO_v2.md no canal). Resumo pra tua implementacao em AlertasCriticos.cs + DeltaCoach.cs:

FASE 1 (rapido — texto/numero/remocao):
- Textos: MOTOR QUENTE->'Motor Quente'; MOTOR AQUECENDO->'Temperatura Motor Subindo'; FALHANDO->'Falha Cilindros' (SOBE pra Critico); SEM DADOS->'Desconectou'; REGISTRANDO->'Coletando Dados'; PISOU POUCO->'Acelere Mais'.
- Numeros: agua 80->70; MISTURA POBRE lambda 1.15->1.0, giro 3000->3500, tps 15->50; MISTURA RICA lambda 0.80->0.74 + carga giro>3000/tps>40 + DURACAO>=1.0s (histerese nova); BATERIA 11.8->12.5; OLEO BAIXO tira o gate >2000rpm (qualquer rpm) — mas por favor poe histerese ~2s pra nao piscar falso na PARTIDA (nota honesta, nao muda a intencao do Flavio).
- SEM GPS = RaceBox (nao iPhone) — corrige fonte-da-verdade §2 tambem.
- REMOVER (9 alertas): Combustivel Baixo (os 2), Motor Esfriando (vira chuva azul, ja existe), Oleo Quente, Escape Quente, Detonacao, Roda Travou, Freio Quente, Pista Suja.
- REMOVER coach: Buscar Limite + as 4 VIROU (Cedo/Pouco/Tarde/Muito). Sem mensagem de volante — o piloto corrige pela BOLINHA do apice. Em DeltaCoach.Decidir o ramo 'apice' deixa de emitir frase; some ClassificarApice + as 4 constantes + BuscarLimite.

FASE 2 (projeto de cerebro, IA de padrao — casa com deteccao_por_padrao_historico):
- Temperatura Motor Subindo: IA por padrao historico (nao 70 fixo) — aprende normal do carro + externa, avisa subida consistente fora do padrao (ex normal 55/max 57 -> 60-63 subindo).
- Pneu Aquecendo / Pressao Pneu: IA de padrao do pneu (media/max/min andando), avisa furo/queda de pressao.
- Pneu Quente: 105°C (1 campo) ou 2 niveis (radial 95/105, semi-slick 105/115).
- Latentes ate sensor: Pneu (temp+pressao) e Cambio (temp) — Flavio mandou manter.

Modo critico (apaga painel, so a msg piscando devagar) = padrao de TODA critica — ja e o teu gap 6. Nada de producao. Detalhe fino na spec. — imac
