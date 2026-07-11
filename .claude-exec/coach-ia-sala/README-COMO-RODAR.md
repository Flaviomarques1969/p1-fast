# SALA DE COMANDO — Coach de IA de Stint (Fable 5 coordenando 5 janelas Opus 4.8 1M)

> Guia de operação para o Flávio. Modelo **sob demanda, econômico**: o Fable fica desligado e só é acionado quando uma janela conclui. Cada janela **deixa tudo pronto** pra ele auditar numa passada só. Você é o gatilho entre "janela concluiu" e "Fable audita" — só nesse momento, não como carteiro do tempo todo.

## Como funciona (o fluxo)

1. Cada janela trabalha a sua frente e, **ao concluir**, deixa a entrega completa + um **"pacote pronto para auditoria"** na mesa compartilhada (em disco).
2. A janela **te avisa** ("terminei a Janela N, tudo pronto — avise o Fable").
3. **Você** vai na janela do Fable e diz **"audita janela N"**.
4. O Fable **acorda**, lê o pacote pronto (não precisa cavar), **audita**, escreve a **orientação na caixa daquela janela**, te dá o **veredito em uma linha**, e **volta a dormir** (não fica em vigia gastando).
5. Você diz pra janela **"o Fable respondeu"** → ela lê a orientação e **aplica** (segue, corrige, ou encerra).
6. Repete até as 5 fecharem. Aí você diz ao Fable **"sintetiza"** e ele junta tudo em `entregas/SOLUCAO-FINAL.md`.

> **Por que assim:** o Fable não fica ligado esperando (isso queimaria tokens à toa). Ele só gasta no momento da auditoria. As janelas também não ficam em loop — trabalham, concluem, param.

## As 5 frentes (uma por janela)

| Janela | Frente |
|--------|--------|
| 1 | **Metodologia de coaching + a mensagem** (Parte B) + quando aparecer |
| 2 | **Inteligência que escolhe a MAIOR oportunidade** (em segundos) |
| 3 | **O gráfico com ZOOM do trecho** (Parte A) |
| 4 | **Integração, dados e arquitetura + plano em fases** |
| 5 | **Cenários reais prontos + auditoria de coerência (QA)** |

## Como rodar (passo a passo)

1. **Abra 6 janelas** do Claude Code, todas na pasta `/Users/imac/Projetos/P1 Fast`.
   - **Janela 0 = o maestro** → modelo **Fable 5**.
   - **Janelas 1 a 5 = os trabalhadores** → **Opus 4.8 (1M)** em cada.
2. **Janela 0 (Fable):** cole **`COORDENADOR-FABLE5.md`**. O Fable faz a **Rodada 0** (lê o briefing, trava o contrato entre as janelas, prepara a caixa de correio, escreve `PLANO-MESTRE.md`) e depois **fica de prontidão** — sem vigiar, só esperando você chamar. Quando ele disser "Rodada 0 pronta — pode soltar as janelas", siga.
3. **Janelas 1 a 5:** cole em cada uma o seu prompt (**`PROMPT-JANELA-1.md`** na janela 1, etc.). Cada uma trabalha até concluir e então te avisa.
4. **A cada "terminei" de uma janela:** você diz ao Fable "audita janela N". Ele audita e devolve. Você repassa o "o Fable respondeu" pra janela. Só isso.

## A mesa compartilhada (o mapa da pasta)

```
coach-ia-sala/
├─ README-COMO-RODAR.md          ← este guia (você)
├─ COORDENADOR-FABLE5.md         ← cole na Janela 0 (Fable)
├─ PROMPT-JANELA-1.md … 5.md     ← cole em cada trabalhadora
├─ PLANO-MESTRE.md               ← o quadro do maestro
├─ entregas/janela-1.md … 5.md   ← cada janela PUBLICA sua entrega (as outras podem LER)
├─ entregas/SOLUCAO-FINAL.md     ← o Fable junta tudo no fim
└─ canal/
   ├─ janela-1/para-fable.md      ← SÓ a janela 1 escreve (deixa o pacote pronto)
   ├─ janela-1/do-fable.md        ← SÓ o Fable escreve (orienta a janela 1)
   └─ … (2 a 5, mesmo par)
```

Regra de ouro da caixa: **cada arquivo tem um dono único que escreve** (a janela na `para-fable`, o Fable na `do-fable`). As mensagens são **acrescentadas** com hora, nunca sobrescritas.

## Como as janelas "se comunicam"

- **Entre si:** cada janela LÊ as entregas publicadas das outras (`entregas/janela-N.md`) — é assim que a mensagem (J1) e o gráfico (J3) sabem o que o cérebro (J2) decidiu. Leitura livre, a qualquer momento.
- **Coordenação, dúvida ou conflito:** vai pelo Fable, no momento da auditoria. O maestro é o centro.

## O que você pode trocar (é só pedir)

- **O corte das 5 frentes.**
- **Design x construção** — hoje as janelas **projetam**; dá pra mandar já **implementar** código (aí cada uma trabalha num ambiente isolado pra não pisar na outra).

## Regras que valem pra todas as janelas e pro maestro

Fundo preto (nunca branco), sem emoji (só ícone de traço), sempre "você", tela 956×440, **não quebrar o painel aprovado**, **produção protegida** (só desenvolvimento), e **só dado real** — nada de inventar volta, campo ou passagem.
