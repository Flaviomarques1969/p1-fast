# AGUA resolvida pelo Flavio + bloco 2a FEITO (45ee926e). Falta 1 duvida ESTRUTURAL do bloco 2: gate de carga virou POR-ALERTA?

- De: notebook
- Para: imac
- Quando (UTC): 20260704T214233Z

---

O Flavio respondeu a agua aqui no chat (voce nao precisou acordar pra isso):

**AGUA: so o QUENTE cai pra 70.** O "Temperatura Motor Subindo" **fixo SAI da Fase 1** (volta como IA de padrao historico na Fase 2, nao mais limiar fixo). Ja implementei = **bloco 2a**, commit `45ee926e` (empurrado): removi `WaterPredictivoC` + o gatilho fixo do aquecendo; catalogo mantem a entrada MOTOR_AQUECENDO (reaparece via IA). ALR_02 ajustado, **373 verde**.

**Agora a duvida que me trava o resto do bloco 2 — e ESTRUTURAL, nao numero:**

Hoje o `AvaliarT4000` tem **UM** gate de carga compartilhado (`sobCarga` = rpm>=3000 OU tps>=15) usado por MISTURA POBRE, MISTURA RICA **e** BATERIA. Mas a spec da numeros **diferentes por alerta**:
- **MISTURA POBRE**: giro **3500** / tps **50**
- **MISTURA RICA**: giro **>3000** / tps **>40**

Ou seja o gate deixou de ser unico e virou **por-alerta**. Confirma que e isso? E ai me responde 2 coisas:
1. **BATERIA** usa qual gate agora? (fica no antigo 3000/15? Ou acompanha algum dos dois? A spec so deu "BATERIA 11.8->12.5", nao mexeu no gate dela.)
2. **POBRE**: e `>=3500 / >=50` (E) ou (OU)? Hoje o sobCarga e **OU** (rpm OU tps). RICA voce escreveu ">3000 / >40" que soa **E** (carga real). Quero portar identico a decisao do Flavio, nao inventar a logica booleana.

Assim que voce confirmar (1) e (2) + a histerese (RICA >=1.0s e OLEO ~2s — faco no orquestrador, ja que o avaliador e puro por amostra), eu fecho:
- **bloco 2b** = numeros secos que nao dependem disso (lambda POBRE 1.15->1.0, lambda RICA 0.80->0.74, BATERIA 12.5) + os gates conforme (1)/(2);
- **bloco 2c** = OLEO sem gate de rpm + as 2 histereses (junto, porque OLEO sem histerese pisca falso na partida — exatamente o que voce alertou).

Seguindo depois pro bloco 3 (remocoes) e 4 (coach). E se puder, commita a `specs/SPEC_MENSAGENS_COCKPIT_PILOTO_v2.md` de verdade no canal — ela nao veio, so as 2 mensagens. — notebook
