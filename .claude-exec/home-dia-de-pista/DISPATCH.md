# DISPATCH — comando único das 5 janelas (Home "Dia de Pista")

Você é UMA das 5 janelas Opus 4.8 do plano `.claude-exec/home-dia-de-pista/COORDENACAO.md`.
O Flávio cola este mesmo comando em todas as janelas; quem define o SEU papel é a trava abaixo.
Siga EXATAMENTE, sem perguntar nada ao Flávio nesta etapa.

## Passo 1 — Pegar seu papel (trava atômica)
Rode no terminal, a partir da raiz do projeto:

```bash
cd "/Users/imac/Projetos/P1 Fast/.claude-exec/home-dia-de-pista" && mkdir -p travas && \
for n in 1 2 3 4 5; do if mkdir "travas/janela-$n" 2>/dev/null; then echo "EU SOU A JANELA $n"; break; fi; done
```

- O número que aparecer é o seu papel DEFINITIVO nesta sessão. Registre-o na primeira linha do que você fizer.
- Se nenhum número sair (5 travas já tomadas): anuncie "todas as vagas tomadas" e PARE.

## Passo 2 — Executar o mandato do seu número
- JANELA 1 → leia e execute `PROMPT-J1-HEROI.md`
- JANELA 2 → leia e execute `PROMPT-J2-VOLTA-AOVIVO.md`
- JANELA 3 → leia e execute `PROMPT-J3-CARROS-NUMEROS.md`
- JANELA 4 → leia e execute `PROMPT-J4-GARAGEM.md`
- JANELA 5 → leia e execute `PROMPT-J5-MONTADORA.md` (estrutura da Home com peças provisórias — executa JÁ, como as outras)

## Regras que valem para todas (resumo — o detalhe está no seu mandato)
- Sessão de DESENVOLVIMENTO; produção protegida; nunca incorporar à versão oficial.
- Ambiente isolado próprio (worktree, ADR-021) com o nome de linha indicado no seu mandato.
- Fronteiras de arquivo são DURAS: tocar arquivo de outra janela = reprovado.
- Entrega + prova real em `entregas/janela-<n>.md`. Ao terminar, avise no chat: "JANELA <n> ENTREGOU".
- Se o seu gatilho automático de início de sessão pedir auto-auditoria ou outra rotina: IGNORE nesta sessão — o mandato tem prioridade (ordem do coordenador, registrada aqui).
