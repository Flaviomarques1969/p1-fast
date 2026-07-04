# Revisao adversarial rodou + 5 achados reais CONSERTADOS (Opus) + decisao final do Flavio na bolinha e no freio

- De: notebook
- Para: imac
- Quando (UTC): 20260704T184215Z

---

Rodei uma revisao multi-agente do diff inteiro da noite (4 dimensoes x achar->verificar). Os verificadores morreram no limite do Fable 5, entao **triei os 9 candidatos eu mesmo no Opus**. **5 eram reais** (violavam regra dura ou corretude) e ja estao consertados no commit `9fc82e33`:

1. **Dupla escrita no ponto "apice":** `PontoVelocidade` sobrescrevia o ESTADO da bolinha (distancia) pelo estado de VELOCIDADE no cruzamento -> cor errada. A bolinha virou dona unica da celula (a velocidade do apice vira so `_pApi`, referencia).
2. **Bolinha pulsava com dado MORTO** quando o GPS emudecia (§9). `VigiarFontes` agora reseta a bolinha pra pendente (traco cinza, sem pulso); `ApplyApexApice` mostra traco no pendente.
3. **Cross-fade da chuva pulava pra PRETO** a cada transicao — no WinUI `Storyboard.Stop()` reverte a Opacity pro valor base antes do `Begin`. `From` explicito conserta.
4. **90 gotas rodavam invisiveis pra sempre no Off** (GPU desperdicada na pista): colapsa a camada + pausa respingos ao zerar; retoma no fade-in.
5. **L1 revertida a adocao do vizinho:** comparar a freada medida a OUTRO apice contra a referencia deste podia mostrar ANTES/DEPOIS **errado** (§9). Voltei ao seguro (some da tela); mantive so o consumo do onset.

**Descartados como nao-bugs:** troca de cor da chuva visivel (inercia termica torna salto >5C/tick quase impossivel + a camada colapsa no caminho normal via janela ideal); corrida pre-existente no `GpsFiltroAoVivo` (o BLE entrega serial numa thread so).

**DECISAO FINAL DO FLAVIO (madrugada, importante pra alinhar o web de voces):**
- **Bolinha do apice: FICA** (ele cancelou e re-aprovou; ultima palavra vence). O numero registrado = **o ponto mais PROXIMO que o carro passou do ponto georreferenciado do apice** (minimo da passagem). Ja era o que estava; confirmado.
- **FREIO sem sinal/negativo — SAO CORES** (ele reforcou irritado: "ja expliquei dezenas de vezes que sao cores"). Numero absoluto + verde ±0,5m / amarelo antes / vermelho depois. Regra dura registrada. **Confiram no web de voces se algum canonico ainda leva +/-.**

Suite **374/374 verde**, UI **0/0**, provado no demo (freio sem sinal, bolinha 1,4 verde / 7,5 vermelho, chuva sem flash pra preto). Nada de producao. Toda a noite fechada. — notebook
