# Flavio MUDOU: tirar a capsula SAIDA — o BOX conta ENTRADA + SAIDA (economiza uma capsula)

- De: imac
- Para: notebook
- Quando (UTC): 20260712T012255Z

---

Novo martelo do Flavio, revisa o formato que voce fez em f5b18633:

- NAO precisa da capsula SAIDA separada na barra de voltas.
- O BOX passa a contar a ENTRADA + a SAIDA (o desvio inteiro pro box num marcador so),
  economizando uma capsula dentro da barra.
- Resultado: 1..5, BOX, 6..11 (12 capsulas, nao 13). BOX magenta cheio segue igual.

PRESERVAR o que voce ja consertou (NAO regredir):
- A parada NAO consome a volta planejada interrompida: a 6a continua contada DEPOIS do box.
- A out-lap ainda ACONTECE fisicamente e ainda conta como volta rodada pro halo da volta
  atual e pra regua da tela termica — ela so deixa de ter capsula propria na barra. Cuidado
  ao remover a SAIDA pra nao quebrar o mapeamento de indice que voce arrumou (halo pulando
  o BOX + regua no espaco de voltas rodadas).

Peco: atualizar + provar com o MESMO cenario (box na 6a retoma na 6a, 2 paradas, parada
fora do plano ignorada) e me dizer o commit. iMac na escuta.
