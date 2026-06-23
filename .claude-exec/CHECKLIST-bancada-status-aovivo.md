# Roteiro de teste — Tela de status AO VIVO (fazer quando o carro voltar da manutenção)

> Bloqueado em 23/06/2026: carro em manutenção, sem teste em campo.
> O que é da TELA já está provado (recebe e traduz o dado, vira parado↔andando sozinha).
> Falta só provar com os APARELHOS REAIS transmitindo. Este roteiro é pra esse dia.

## Pré-condições pra QUALQUER dado chegar na tela (a tela não gera dado sozinha)
1. RaceBox (GPS) ligado, a céu aberto, com sinal travado (fix).
2. Central de Pista no ar, lendo o RaceBox → ela é quem PUBLICA o GPS no canal.
3. Motor: o programa do cockpit lendo a injeção pela USB → é quem PUBLICA o motor no canal.
4. Tela de status aberta no modo ao vivo: .../checar-antes-de-rodar.html?fonte=aovivo
- Faltando QUALQUER um destes, a tela mostra "AGUARDANDO O CARRO". Isso é o CERTO, não é defeito.

## O que tem que acontecer (prova de que é real)
- Cabeçalho: "Ao vivo · no ar" (e não "sem conexão").
- Parado, motor ligado: rotação/água/lambda/bateria com números reais; selo "Pronto pra gravar" só quando GPS + motor estão chegando.
- Andar com o carro: a velocidade sobe e, passando de ~15 km/h, a tela vira sozinha pro painel do piloto; ao parar, volta pro status.
- Força-G mexe com a aceleração/frenagem.

## Pontos a confirmar no carro (verdades que só o carro mostra)
- FREIO: confirmar o nome do dado que o motor do Bubi entrega de fato (pedalFreioPct x pressaoFreioBar). Hoje a tela lê pedalFreioPct (o que o motor real manda); se vier zerado, é só trocar o campo.
- Que o RaceBox publica GPS de verdade (foi o que faltou em 21/06).

## Atalho pra adiantar SÓ o GPS, sem o carro (opcional)
- O RaceBox é um GPS portátil. Dá pra ligar ele + a Central + a tela e ANDAR com o aparelho na mão (a pé/de carro qualquer): a velocidade e o "andando" aparecem. Prova metade da cadeia sem depender do Bubi.

## Já provado daqui (23/06, sem o carro)
- Conexão ao canal: no ar (SUBSCRIBED).
- Recepção + tradução: emissor de teste (fora da produção) mandou 20 mensagens, a tela recebeu as 20 e mostrou números certos + virou parado↔andando.
- Mapa de campos do dado REAL: todos os nomes batem (rotação, água, lambda, bateria, acelerador, força-G, velocidade/GPS).
- A tela SÓ ouve o canal de produção; nunca publica (conferido).
