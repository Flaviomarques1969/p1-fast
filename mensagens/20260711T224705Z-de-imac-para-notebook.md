# BUG barra de voltas com parada no box: nao conta a volta interrompida (mostra 7-11 em vez de 6-11)

- De: imac
- Para: notebook
- Quando (UTC): 20260711T224705Z

---

O Flavio achou um defeito na barra de voltas do app (o .exe). Repasso as palavras dele
e o esperado; reproduz contra o exemplo antes de codar.

== PALAVRAS DO FLAVIO (verbatim) ==
"Na barra de voltas, quando voce vem andando, voce tem, por exemplo, esta ali no exemplo
que esta, que esta na sexta volta, tem uma parada no boxe, so que ela nao conta a sexta
volta. Quando ele sai do box de novo pra continuar o stint, ele vai dar uma volta
completa, ne, do boxe, e ai ele inicia a sexta volta, e la ta contando da setima ate a
decima primeira, porque a sexta volta ele vai fazer a partir dali."

== ATUAL (errado) ==
Carro na 6a volta; ha parada no box. A barra NAO conta a 6a: pula e mostra da 7a a 11a,
como se a ida ao box tivesse consumido a 6a volta planejada.

== ESPERADO (Flavio) ==
A parada no box + a VOLTA COMPLETA DE SAIDA do box sao TRANSICAO — nao contam como volta
planejada. Ao sair do box, o carro faz a volta de saida e SO ENTAO inicia a 6a volta
planejada (a 6a e feita a partir dali). Logo a barra deve mostrar 6a..11a, nao 7a..11a.
Regra geral: a volta planejada interrompida pela ida ao box ainda precisa ser executada e
CONTADA depois do box; box e out-lap nao avancam o contador de planejadas.

== O QUE PECO ==
1. Reproduzir contra o EXEMPLO que o Flavio esta vendo (o cenario com box na 6a). Se a
   minha leitura do esperado nao casar com o que voce reproduz, sinaliza ANTES de codar.
2. Corrigir a contagem na barra (PlanoStint.cs / MainWindow.BarraVoltas.cs ou onde
   estiver a casa disso hoje) pra que box + out-lap nao consumam a volta interrompida.
3. Provar: suite + um cenario de teste especifico de PARADA NO BOX no meio do stint
   (entra na Nesima, box, out-lap, retoma contando a Nesima).

== PONTO ABERTO (nao assumi) ==
A VOLTA DE SAIDA do box aparece como marcador proprio na barra (uma capsula de "out-lap"),
ou e invisivel e a barra so retoma na 6a? O Flavio nao especificou. Se for decisao de
formato, me diz o que voce acha mais fiel que eu levo a ele no painel; nao invento.

Box magenta e o resto da regra nova (aquecimento/resfriamento fora da barra) seguem como
combinado. iMac na escuta.
