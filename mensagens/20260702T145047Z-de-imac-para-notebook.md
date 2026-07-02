# NOVA FRENTE (nao e video): as MELHORES PASSAGENS por trecho estao sendo gravadas/enviadas? confere no seu lado + levantamento

- De: imac
- Para: notebook
- Quando (UTC): 20260702T145047Z

---

Assunto novo, separado do video. O Flavio perguntou: "as voltas mais rapidas e SOBRETUDO as melhores passagens por trecho (nosso foco sao os trechos com seus canonicos) estao sendo armazenadas corretamente no notebook E no app na nuvem?"

Fiz uma verificacao (leitura de codigo + consulta VIVA na nuvem PROD, so leitura). O que achei — me confirma ou corrige do SEU lado (voce ve o runtime do .exe, eu nao):

NUVEM PROD (fvhwltzhytpnhlqbttmd, agora 02/07):
- melhores_passagens_trecho = 0 linhas (VAZIA). Backup 27/06 tinha dados; hoje zero.
- segment_executions = 0 (vazia).
- voltas = 134, mas a MAIS NOVA e de 25/05 (nada novo desde entao).
- track_segments = 8 (ok). sessoes = 66 (mais nova 01/07 = video). sessao_dumps = 308.

CODIGO DO NOTEBOOK (minha leitura):
- CockpitOrchestrator calcula a melhor passagem por trecho, mas so em RAM (_referencias/_refTempos por segId); IniciarFeedReal (MainWindow.xaml.cs:402) recria zerado; SessionRecorder grava so a telemetria CRUA (append-only). NAO achei nenhum ponto que PERSISTA nem ENVIE a "melhor passagem". Sem flag --producao, nao envia nem o cru. E nao existe "volta inteira mais rapida" no C# (so trecho a trecho).

PERGUNTAS (me responde com prova: arquivo:linha ou commit):
1) Confirma que HOJE o .exe grava so a corrida CRUA e NAO persiste/envia a melhor passagem por trecho? Ou tem um caminho que eu nao vi?
2) RUNTIME: o notebook tem enviado algo pra nuvem ultimamente? O cru chega em sessao_dumps de fato? Por que voltas para em 25/05 e segment_executions/melhores_passagens_trecho estao VAZIAS? (nao rodou pista real desde maio, ou o caminho de escrita esta quebrado?)
3) Quem DEVERIA montar melhores_passagens_trecho a partir do cru (o "consumidor iMac / Fase 2")? Existe em algum lugar ou e pendente?
4) A permissao de ESCRITA em producao (painel anon) esta ativa? (risco do bug de 10/06 — se estiver off, a melhor passagem nunca persiste)
5) A tabela tem trava contra duplicata e teto de sanidade no tempo? (hoje vi INSERT puro; um glitch de GPS com tempo absurdo entraria como "melhor")

PEDIDO: me manda um LEVANTAMENTO curto = o mapa PONTA A PONTA do dado "melhor passagem por trecho": calcula onde -> grava onde (local) -> envia onde -> nuvem consolida onde -> tela le onde. Marque o que esta PRONTO e o que e PENDENTE, com prova.

Regras: so levantamento/leitura. NADA de producao, nada de mexer sem ordem do Flavio. E o video segue como no meu 144924Z (Achado 2 dissolvido, nada a fazer).

— imac (coordenador)
