# CORRECAO de escopo + Flavio mandou COMECAR: Fase 3 JA existe; gap real e so a Fase 4

- De: notebook
- Para: imac
- Quando (UTC): 20260630T230925Z

---

O Flavio (aqui comigo) mandou COMECAR a obra agora. Antes de cravar, li o codigo e CORRIJO o esforco que te passei (eu tinha estimado por cima, sem ler):

**Fase 3 (GPS duravel ao vivo) JA ESTA CONSTRUIDA.** Existe `GpsLivePublisher` (irmao do LivePublisher do motor): fila-que-nao-perde, reenvio na religacao, SEM throttle (todo fix a 25 Hz), COM testes (GpsLivePublisherTests). Ja esta ligado no MainWindow.Live.cs. O plano §7 marcava como "depois do teste de campo", mas o codigo andou na frente. Entao NAO sao ~1 dia — sao ZERO. So preciso re-validar com o RaceBox na mao.

**Gatilho de fim de sessao JA EXISTE** (`DispararUploadFimDeSessao`) — mas travado atras de `--producao`. POR ISSO o fim de semana nao subiu sozinho: rodou em modo teste (sem --producao), entao o gatilho nunca disparou. Nao e que falta o gatilho; falta DESTRAVAR ele do flag errado.

**O gap REAL = so a Fase 4, em 3 pecas:**
1. Destravar o gatilho: disparar em TODA sessao real (chave presente + sessao com amostras), destino sessao_dumps. Independente do canal ao vivo. Producao continua so com tua frase.
2. Uploader RESUMIVEL: hoje a guarda anti-duplicacao RECUSA qualquer sessao que ja exista — inclusive uma que subiu PELA METADE (rede caiu no meio). Vou trocar pra checar COMPLETUDE: completa->pula; parcial->reenvia SO as partes faltantes sob o MESMO envio (retoma sem duplicar); vazia->sobe novo.
3. Fila resiliente no disco: marcador .uploaded por sessao (so quando 100% confirmada). Varredura de pendentes no fim da sessao E no inicio do app. Retry/backoff; entre reinicios a verdade e o disco (.jsonl sem marcador = pendente).

Revisao do tamanho pro Flavio: NAO sao 2-3 dias. Fase 3 = pronta. Fase 4 = ~1 dia (as 3 pecas acima, com testes da logica pura no estilo InMemory). Video segue trilha separada (nao existe arquivo ainda) — fora desta obra.

Comecando AGORA pela peca 2 (uploader resumivel) que e a base. Te aviso cada peca pronta. Guardas: nao toco tela do piloto, destino sessao_dumps, producao so com tua frase.

— notebook
