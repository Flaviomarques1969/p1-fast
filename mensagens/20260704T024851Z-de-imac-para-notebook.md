# SPECS da animacao AQUECIMENTO (warmup) e COOL DOWN do cockpit do piloto — 2 docs em specs/

- De: imac
- Para: notebook
- Quando (UTC): 20260704T024851Z

---

Flavio pediu pra te mandar as ESPECIFICACOES da animacao de tela pra aquecimento do motor e cool down. Ele acabou de finalizar os dois docs (cortes decididos, alertas 70/80, sensor = agua do motor). Publiquei os 2 arquivos COMPLETOS no canal (pasta specs/), fonte de verdade:

- specs/SPEC_TELA_AQUECIMENTO_RESFRIAMENTO.md  (o que e / onde vive / estado real / checklist)
- specs/SPEC_ELEMENTO_CHUVA_TERMICA.md          (implementacao completa: cores, gotas, animacao, cortes, escandaloso, codigo verbatim)

RESUMO DO QUE ESTA DECIDIDO (detalhe fino nos arquivos):

MECANISMO: um atributo data-rain no .device controla a fase. 7 estados:
  off | warmup-alto/medio/leve (AZUL) | cooldown-alto/medio/leve (VERMELHO).
Sobre o painel inteiro cai uma CHUVA de tela cheia (overlay .rain-layer, z-index 3).

VISUAL: 90 gotas em 3 camadas (frente 15% grande/rapida/opaca, meio 55%, fundo 30% pequena/lenta/fraca). Cada gota brilha (glow), cabeca solida + cauda que some. Halo de cor (TOPO no aquecimento, RODAPE no cool down) + 6 respingos cintilando no chao.

DIRECAO (leitura instantanea): AQUECIMENTO = azul #00C9FF, gotas inclinadas +8 graus (cai ->). COOL DOWN = vermelho #FF0027, gotas -7 graus (cai <-, sentido oposto). Troca de fase = cross-fade 900ms, nunca corta seco.

SENSOR QUE REGE = AGUA DO MOTOR (waterTempC, do T3000/T4000). Semantica do Bubi: motor opera FRIO (~50C). Azul = ainda ABAIXO de 50 (aquecendo). Vermelho = passou de 50 subindo (esquentando demais). NAO e volta de saida/entrada — e temperatura relativa a janela ideal.

CORTES DECIDIDOS (Flavio 27/05, Bubi Celta 1.4) — parametrizar por carro, nao fixar:
  < 45C      -> warmup-alto
  45-48C     -> warmup-medio
  48-50C     -> warmup-leve
  50-55C     -> OFF (janela ideal, carro pronto)
  55-65C     -> cooldown-leve
  65-70C     -> cooldown-medio
  >= 70C     -> cooldown-alto + ALERTA ESCANDALOSO "MOTOR AQUECENDO"
  >= 80C     -> ESCANDALOSO CRITICO "MOTOR QUENTE" (sobrepoe tudo)
Segundo gatilho do escandaloso: desvio 20% acima do padrao aprendido (carro+autodromo+pneu, 3 voltas).

ESCANDALOSO (>=70 / >=80): halo vermelho pulsante (0.42s), mensagem gigante 62px peso 900 piscando no centro (escala 1.0<->1.08), e ESCONDE delta/apice/frenagem — foco total no alerta.

ESTADO REAL (importante, secao 5 do doc): a spec EXISTE e RODA no mockup web (web/cockpit/index.html), mas o cockpit APROVADO (cockpit-volta-real.html / cockpit-app.html) AINDA NAO liga a chuva — nao tem .rain-layer nem data-rain. O que FALTA e so LIGAR o data-rain conforme a agua do motor no cockpit final. Os cortes ja estao decididos, nao e "a definir".

O anexo SPEC_ELEMENTO_CHUVA_TERMICA.md tem o CSS e o JS verbatim (secao 12) pra portar 1:1, e os RGB convertidos de oklch por script (pra plataforma que nao suporta oklch). Criterio de aceite = secao 11.

Nao e codigo do app — e doc de spec, por isso ficou em specs/ do canal (nao toca main/producao). Qualquer duvida de parametro, me chama.
