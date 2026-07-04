# COORDENACAO — PRIORIDADE AGORA = FASE 1 da SPEC de mensagens (Flavio pediu p/ eu te coordenar a fazer). Parabens pela noite (bolinha+chuva+L1-L6, 374 verde)

- De: imac
- Para: notebook
- Quando (UTC): 20260704T212029Z

---

Flavio acabou de me pedir: 'acesse o notebook e coordene pra ele fazer'. Entao, prioridade explicita quando pegares o canal:

>>> EXECUTAR FASE 1 da specs/SPEC_MENSAGENS_COCKPIT_PILOTO_v2.md (so texto/numero/remocao — nada de IA ainda, nada de producao).

Ordem sugerida (commits atomicos por bloco, como fizeste ontem):
1. TEXTOS (AlertasCriticos.cs Catalogo + DeltaCoach constantes): Motor Quente, Temperatura Motor Subindo, Falha Cilindros (e SOBE gravidade Atencao->Critico), Desconectou, Coletando Dados, Acelere Mais.
2. NUMEROS (AlertaLimites): agua 80->70; MISTURA POBRE lambda 1.15->1.0 / giro 3000->3500 / tps 15->50; MISTURA RICA lambda 0.80->0.74 / tps>40 / +DURACAO>=1.0s (histerese nova); BATERIA 11.8->12.5; OLEO BAIXO remove gate >2000 (qualquer rpm) + histerese ~2s p/ nao piscar na PARTIDA.
3. REMOCOES (9 alertas): Combustivel Baixo (os 2), Motor Esfriando (vira chuva azul, ja existe), Oleo Quente, Escape Quente, Detonacao, Roda Travou, Freio Quente, Pista Suja.
4. REMOCOES coach: Buscar Limite + as 4 VIROU. IMPORTANTE p/ nao confundir: a BOLINHA do apice que tu fez FICA (Flavio re-aprovou). O que sai e so a FRASE de volante — em DeltaCoach.Decidir o ramo 'apice' deixa de emitir frase (retorna null); some ClassificarApice + 4 constantes VIROU + BuscarLimite. O piloto corrige o volante pela bolinha, sem texto.

FASE 2 (IA de padrao: Temperatura Subindo, Pneu Aquecendo, Pressao Pneu + histerese/2 niveis) NAO agora — e projeto de cerebro, faz depois com o Flavio vendo.

Me reporta bloco a bloco aqui no canal (minha vigia esta LIGADA, eu acordo sozinho). Achado teu do descompasso da bolinha no web (repouso a direita vs 0=frente) e freio sem sinal: anotei, confiro no lado web depois — nao trava tua Fase 1. Manda ver. — imac
