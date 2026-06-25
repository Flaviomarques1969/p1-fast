# BRIEFING — o WASH DA TROCA (evento FIRE / "TROCA AGORA") na luz de marcha

> Para a sessão Claude do NOTEBOOK (Windows). Origem deste briefing: sessão do Mac, 25/06/2026.
> Trabalhe na linha de sincronização `sync/notebook-dia-de-pista-2026-06-23`. NÃO mexer na versão
> oficial (main). NÃO publicar nada (cockpit-bubi-live é PRODUÇÃO: ouvir pode, publicar NÃO).
> Texto ditado pelo Flávio — é a verdade do comportamento, não inventar nem afrouxar.

## O wash da troca (evento FIRE / "TROCA AGORA")

- **Duração total:** 0,30 segundo (300 milissegundos). É um disparo único por troca — acontece,
  pisca e some (não fica repetindo). Roda uma vez a cada troca de marcha.
- **Padrão:** 3 pulsos brancos dentro desses 300 ms
  (acende-apaga-acende-apaga-acende, e desvanece).
- **Velocidade:** ~10 piscadas por segundo (10 Hz) — o código diz que é o "ponto ideal da detecção
  periférica" (você pega o clarão com o canto do olho mesmo olhando pra pista).
- **Cor:** branco-azulado — escolhida de propósito pra ser diferente do verde/amarelo/vermelho da
  subida de rotação. Assim o cérebro lê como "EVENTO: troque agora", e não como "mais um nível subindo".
- **Intensidade:** o clarão é mais forte no topo da tela e se espalha pra baixo, com brilho na borda
  inteira. A cada pulso vai de apagado → 100% → apagado.

## São 3 camadas sincronizadas (tudo no mesmo ritmo)

1. A luz central do shift light acende e "estoura" (cresce de tamanho) — o sinal principal de trocar.
2. A moldura do shift light ganha um brilho azul em volta.
3. A tela inteira dá o wash branco-azul (esse é o "lavado") — uma camada por cima de tudo
   (fire-overlay), pra garantir que você percebe mesmo de canto de olho.

## Cuidado pra não confundir

Existe um outro estado, o OVERREV (quando passou do ponto e está estourando a rotação): aí todos os
LEDs piscam vermelho, em ritmo mais lento e contínuo (a cada 0,15 s, ~6-7 Hz), e não para até a
rotação cair. Esse é alarme de "passou da hora", é vermelho, e NÃO é o wash branco-azul da troca.

## Resumo

O wash da troca = clarão branco-azul, na tela inteira, 0,30 s, 3 pulsos a 10 Hz, uma vez por troca.
