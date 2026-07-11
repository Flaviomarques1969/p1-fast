# Caixa da Janela 3 → Fable — só a Janela 3 escreve aqui

> Sempre ACRESCENTE blocos com hora (`date -u +%FT%TZ`); nunca sobrescreva. Ao medir o retângulo livre do miolo, poste as medidas aqui (o contrato de layout depende disso). O bloco final obrigatório é o `PRONTO PARA AUDITORIA` do seu prompt.

### 2026-07-08T19:59:44Z — Janela 3 · MEDIDA DO MIOLO (o contrato de layout depende disto)
Palco .device = 956×440 (cockpit.css:54). Origem = canto sup-esq.
PERMANENTES (nunca cobrir): sensores y6–41 · barra-voltas y50–64 · luz-freio ESQ x5–19 / DIR x937–951 (y~81–295) · ápice+entrada/freio/vmin/saída y320–380 · shift-light y~396–430.
Maior retângulo limpo dos permanentes: x60→896 × y72→312 (≈836×240).
COLISÃO: delta (info-bloco, fs-9 180px) ocupa ~x72–412·y97–255 à ESQ; freada/última-volta ~x540–840·y97–255 à DIR. Tomado ao pé da letra sobra só x412–540 (128px) — inviável.
RECOMENDO caminho (b) TEMPO-EXCLUSIVO: cartão e números gigantes não coexistem (números = saída de curva; cartão = reta/fim-de-volta/box da J1). O painel JÁ tem o gancho: device[data-msg-state=ativa] desliza o delta −230px (cockpit.css:466-468) e ultima-volta já esconde brake-result (HTML:162). Única adição: brake-result cede enquanto o cartão está no ar (1 regra, mesmo padrão).
CARTÃO PROPOSTO (caminho b): x150→806 · y74→312 (h238). GRÁFICO(60%) x150→544 · MENSAGEM(J1,40%) x550→806 (6px calha). Slot fixo, layout não muda com conteúdo. 60/40 provisório — arbitra com a J1 (ela precisa ≥256px; cabe).
Decisão sensível (visual do Flávio): aprovar caminho (b). Detalhe em entregas/janela-3.md §2.

### 2026-07-08T19:59:44Z — Janela 3 · PRONTO PARA AUDITORIA
Entrega: entregas/janela-3.md (completa)
Resumo (até 5 linhas):
- Plota (recomendado): recorte ampliado do TRAÇADO da curva + sua linha vs referência + ápice + sub em foco (Fase 1); velocidade×distância e traço de freio = camadas Fase 2 (casa com J4).
- Zoom PROVADO com dado real: tracos→geoParaDesenho(823×799)→bbox+14%→viewBox; contexto por índice em PONTOS_DESENHO. Caveat: fracDe é OUTRO espaço (CB 130 110 580 660) — não misturar.
- Achado de dado: apices-semente NÃO casa com as passagens em 7/8 curvas (53–164px; só Curva 2 bate) → ancoro no oportunidade.tracos + oportunidade.apice (J2), não no semente. Sinalizado à J2/J4.
- Consumo do objeto v1 REAL da J2 (tracos/subTrecho podem ser null → modo degradado tratado); GraficoSpec devolvida no envelope da J4; obedeço o portão da J1 (não redefino timing).
- Medidas do miolo postadas acima; mockups escuros dos 4 casos com px em §7.
Consumi: objeto oportunidade v1 (J2) · portão (J1) · envelope grafico (J4) · geometria da pista · Produzi: spec do gráfico + GraficoSpec + medidas do cartão
Autoconferência da régua: preto · sem-emoji · você · 956×440 · número-sem-sinal · só-dado-real · timing-seguro · ganho-em-s (é da J1) · painel-preservado
Dúvidas/decisões ao maestro: (1) aprovar caminho (b) da colisão delta/freada — visual sensível do Flávio; (2) medidas 60/40 e x150→806 (arbitrar com J1); (3) confirmar Fase 1 = traçado com zoom; (4) furo de dado ápice-semente (§5) p/ J2/J4.

### 2026-07-08T22:04:48Z — Janela 3 · CORRIGIDO (§5) + PRONTO PARA AUDITORIA
Veredito atendido: CORRIGIR (pontual) do bloco 20:55 — troquei o "7/8" pelo método/tabela em METROS da J5 (janela-3.md §5).
- Agora: 4/8 DIVERGEM (Bruxa 70,4m · Placar 235,0m · "S" 99,9m · Vitória 82,4m); CASAM Curva 01 3,2m · Reta Oposta 2,5m · Curva 2 4,0m · Junção 5,2m.
- Registrei por que meu 7/8 estava inflado (comparei com ponto-do-meio da passagem, não com a linha; limites de segmento tortos — F1 da J5).
- Minha DECISÃO DE ANCORAGEM fica de pé e o QA endossou: âncora = oportunidade.tracos + oportunidade.apice, nunca o semente — as duas curvas-estrela (Bruxa e "S") estão entre as que divergem.
- Registro de correções: a J5 já acrescentou a entrada corretiva referenciando a minha; deixei a cadeia (achado→correção) intacta pra não órfã a referência.
Nada mais pendente da minha frente. De prontidão para APROVADO (que depende do martelo do Flávio no caminho (b) + fim do QA).
Autoconferência da régua: preto · sem-emoji · você · 956×440 · número-sem-sinal · só-dado-real · timing-seguro · painel-preservado.
