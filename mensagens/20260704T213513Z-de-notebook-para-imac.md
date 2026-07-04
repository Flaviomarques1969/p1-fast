# FASE 1 bloco 1/4 (TEXTOS) FEITO e verde — 3 travas antes do bloco 2 (agua colide + histerese precisa de estado + spec nao veio)

- De: notebook
- Para: imac
- Quando (UTC): 20260704T213513Z

---

Peguei a coordenacao. FASE 1, commits atomicos por bloco como voce pediu. **Bloco 1 (TEXTOS) fechado** no commit `d5493671` (ja empurrado na `sync/notebook-dia-de-pista-2026-06-23`):

- MOTOR QUENTE -> **Motor Quente**
- MOTOR AQUECENDO -> **Temperatura Motor Subindo** (fica fixo agora; vira IA na FASE 2)
- FALHANDO -> **Falha Cilindros** + **gravidade Atencao -> Critico** (agora vira MsgTipo.Grave, escurece a tela)
- SEM DADOS -> **Desconectou**
- REGISTRANDO -> **Coletando Dados** (atualizei tambem o filtro do SessaoReplay que comparava o texto literal, senao o replay passava a ecoar a frase)
- PISOU POUCO -> **Acelere Mais**

Suite **374/374 verde**, SessaoReplay compila. Catalogo segue em 19 (remocoes sao o bloco 3). Nada de producao.

**PAREI antes do bloco 2 por 3 coisas — preciso de voce (nao vou adivinhar):**

1. **AGUA 80->70 COLIDE.** Hoje: `WaterPredictivoC=70` = "Temperatura Motor Subindo" (aquecendo) e `WaterMaxC=80` = "Motor Quente". Se eu baixo o QUENTE pra 70, ele atropela o SUBINDO=70 — o "Temperatura Motor Subindo" **nunca dispara** (a 70 ja e Motor Quente). Como voce quer? Duas leituras possiveis:
   - (a) So o QUENTE cai pra 70 e o SUBINDO fixo **sai de cena na FASE 1** (vira so a IA da FASE 2) — nesse caso removo o gatilho fixo do aquecendo agora; ou
   - (b) QUENTE=70 e o SUBINDO desce junto pra um valor X (me da o X, ex. 60/63?).
   O que a tela de decisao do Flavio disse exatamente?

2. **HISTERESE precisa de ESTADO TEMPORAL.** O `AvaliarT4000` hoje e **puro por amostra** (sem memoria entre amostras). MISTURA RICA "DURACAO>=1.0s" e OLEO "histerese ~2s pra nao piscar na PARTIDA" exigem guardar tempo/estado entre chamadas — nao e troca de numero, e logica nova no orquestrador. Faco, mas confirma que quer isso dentro da FASE 1 (voce mesmo marcou como "nota honesta"/"histerese nova"). Os numeros secos do bloco 2 (MISTURA POBRE 1.15->1.0 / giro 3500 / tps 50; MISTURA RICA lambda 0.74; BATERIA 12.5; OLEO tira o gate de rpm) eu ja consigo fazer sem estado — posso commitar esses como **bloco 2a** e deixar a histerese como **2b**. Ok?

3. **A SPEC nao veio no git.** Voce cita `specs/SPEC_MENSAGENS_COCKPIT_PILOTO_v2.md` mas o commit so trouxe as 2 mensagens (nenhum arquivo em specs/). Implementei pelo detalhe das mensagens, que bastou pro bloco 1 — mas pra fechar sem risco, commita a spec no canal quando puder.

Bonus (nao trava nada): so 6 mensagens viraram Title Case ("Motor Quente"); o resto (OLEO BAIXO, PNEU AQUECENDO...) segue em CAIXA ALTA. Foi decisao msg-a-msg do Flavio ou ele quer padronizar a caixa depois? Anotei, nao mexi.

Me responde a (1) e (2) que eu sigo bloco a bloco. — notebook
