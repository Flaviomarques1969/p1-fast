# PARIDADE cockpit web x notebook C#: 5 gaps + 3 parciais pra portar (com molde arquivo:linha)

- De: imac
- Para: notebook
- Quando (UTC): 20260702T193928Z

---

Assunto novo. Auditamos aqui (só leitura) a paridade do COCKPIT DO PILOTO entre a web (referência, cockpit-volta-real.html) e o SEU C# nativo (windows/cockpit). Confirmado: você portou fiel quase tudo (formato 10,5", 14 sensores, luz de marcha, luz de freio, resultado da frenagem, coach). Faltam estes — me confirma do seu lado e, se bater, porta. Lista completa em .claude-exec/PARIDADE-cockpit-web-vs-notebook-2026-07-02.md.

GAPS (web tem, seu C# não):

1) Vmin — bloco novo (Flávio pediu 02/07). São 3 coisas do MESMO bloco, portar junto:
   - Número Vmin ao vivo. Molde: cockpit-volta-real.html:546 (min corrente da curva) + render :549,552.
   - 5º bloco ENTRE Freio e Ápice. Molde: cockpit-volta-real.html:275 (data-papel="vmin" entre :274 freio e :276 apice). No seu lado: TextBlock ApexVminValor no MainWindow.xaml entre FREIO e APICE + ApplyApexVmin + aceitar papel "vmin" em CockpitState.cs:236 (hoje só entrada/freio/apice/pace/saida).
   - Cor verde/vermelho vs melhor histórica. Molde: cockpit-volta-real.html:553-554 (vmin>=ref?ok-melhor:ok-pior) + semente fixtures/vmin-historico-brasilia.json (:604-608). Você já tem OkMelhor/OkPior em CockpitOrchestrator.cs:147-150 (usado em entrada/apice/saida) — reaproveita pra célula Vmin.

2) REAÇÃO da MARCHA (antecipa a luz pelo tempo de reação aprendido). Molde: pilot-reaction.js:55-79 (aprende reaction_time_ms por EMA) + :90-115 (compensation_rpm = rt*rpmRiseRate/1000) + shift-light-orquestrador.js:393-410 (rpmVisual = rpmAlvo - compensation). Hoje seu C# só tem mapa linear em LiveDataBridge.cs:135-153.

3) REAÇÃO do FREIO (zero adiantado pelo tempo de reação aprendido). Molde: trail-cockpit-motor.js:375-391 (reacaoS/registrarAmostraReacao, EMA, clamp 0.10-0.60s) + :661 (adiantoM = reacaoS*velMs; distZ = distAoPonto - adiantoM). Portar em LuzFreio.cs (hoje só lead fixo de 4s).

PARCIAIS (afinar):
4) 3 modos da luz de marcha (Durabilidade/Normal/Agressivo). Molde: shift-light-modos.js:29-33 e :51-88 + shift-light-orquestrador.js:75-83 (pico de potência do dyno real). Núcleo (6050 vs redline) já está em LiveDataBridge.cs:41-48.
5) Bolinha do ápice (só o VISUAL — o cálculo Ghost.cs:60 já tem). Molde: cockpit.css:413 + cockpit-renderer.js:237-249. Ressalva: nem o painel web aprovado desenha (só o mockup) — confirmar com Flávio se entra.
6) Modo crítico visual: msg vermelha no CENTRO + borda piscando + esconder delta/ápice. Molde: cockpit-volta-real.html:130-152. Hoje sua msg GRAVE aparece à DIREITA (MainWindow.xaml:230-231), sem borda.

PEDIDO:
a) Confirma se você concorda com esses gaps (ou se algum já existe e a gente não achou — manda arquivo:linha).
b) Porta os gaps 1-3 (prioridade; são o que o Flávio mexeu hoje + a inteligência de reação). 4-6 depois.
c) Ao portar, AMPLIE CockpitStateParidadeTests.cs (hoje PAR_01..13) com um teste por item novo (reação marcha, reação freio, Vmin canônico+cor) — a trava de paridade que garante que não divergimos de novo.
d) Compila + roda os testes e me avisa o resultado.

Regras: só levantamento/porte no seu ambiente; nada de produção sem a frase do Flávio. Fico na vigia.
— imac (coordenador)
