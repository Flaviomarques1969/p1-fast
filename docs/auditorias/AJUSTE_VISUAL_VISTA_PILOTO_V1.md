# Ajuste Visual Vista Piloto V1

Data: 2026-05-14
Modo: ajustes feitos apenas numa cópia isolada em `docs/auditorias/ajuste_visual_vista_piloto/`. **O arquivo ativo do mockup não foi tocado**. Sem registro no histórico, sem envio ao repositório oficial, sem submissão formal, sem incorporação à versão oficial, sem produção.

> Nota de linguagem: "arquivo ativo" = `mockup-command-box-vista-piloto.html` em uso no ambiente isolado `vista-engenheiro`. "Registro no histórico" = `commit`. "Submissão formal" = pull request. "Versão oficial" = `origin/main`.

## 1. Resumo executivo

Foi criada uma versão de ajuste visual da Vista Piloto **partindo do arquivo ativo atual** (idêntico bit-a-bit ao candidato reconstruído `8095f968…`). Os ajustes vivem numa cópia isolada e foram feitos somente em CSS e em um trecho de conteúdo (frase do P1 Coach). Os 38 blocos `id=` foram preservados; nenhuma telemetria foi reduzida; o arquivo ativo continua intocado.

A versão ajustada cresceu de 295.371 bytes para **295.443 bytes** (+72 bytes / +2 linhas) — variação proveniente apenas das mudanças de CSS e da nova frase do coach.

## 2. Arquivo base

| Campo | Valor |
|---|---|
| Caminho | `.claude/worktrees/vista-engenheiro/_design-reference/mockup-command-box-vista-piloto.html` |
| Bytes | 295.371 |
| Linhas | 7.195 |
| Blocos `id=` | 38 |
| SHA-256 | `8095f968936de45084066c49a9932160be280ab88fdd7a1c0430f6d56ae94a30` |

## 3. Arquivo ajustado

| Campo | Valor |
|---|---|
| Caminho | `docs/auditorias/ajuste_visual_vista_piloto/vista_piloto_ajuste_v1.html` |
| Bytes | **295.443** |
| Linhas | **7.197** |
| Blocos `id=` | **38** (preservado) |
| SHA-256 | `bce0bfa8e7a8a6188eec4600e2e3c594ddf312ab4c2f46b1102d913654777fc9` |

## 4. Alterações visuais feitas

Todas as alterações foram **somente** em CSS e na frase exibida pelo P1 Coach. Nenhum bloco foi removido nem renomeado.

### Marcha (centro visual do cockpit)
- Grade do bloco `shift light`: coluna da marcha passou de **42 px → 102 px**; coluna do RPM passou de 78 px → 104 px (mantendo proporção visual de cockpit GT3).
- Tamanho do número da marcha: **30 px → 76 px** (mais de 2,5× maior, dominante na tela).
- Peso do número: **200 → 700** (de fino para bold, ganho de presença e leitura à distância).
- Espaçamento do dígito: ajustado para -3,6 px (mais compactado, próprio de cockpit).
- Brilho sutil ao redor do número (`text-shadow` em prata): leitura noturna típica de DDU / sim racing.
- Altura útil da caixa de marcha: 70% → 92%.
- Label "MARCHA" sob o número: 6 px → 8,5 px, espaçamento `.30em`, ouro principal (mais visível, sem dominar).

### RPM + shift lights
- Tamanho do número do RPM: **24 px → 34 px** (acompanha o aumento da marcha sem competir).
- Peso do RPM: **200 → 500** (ainda mais leve que a marcha, mas legível à distância).
- Espaçamento do RPM: -0,6 px → -1 px.
- Label "RPM" sob o número: 6 px → 8,5 px (mesma regra do label da marcha).
- Shift lights (12 LEDs progressivos): **inalterados** — já tinham gradientes premium, glow e animação `shift-now` por zona (verde / champanhe / âmbar / vermelho / azul).
- Pisca da troca de marcha (`@keyframes sl-flash`): **inalterado**.

### Frase do P1 Coach
- Tamanho da frase: **24 px → 34 px**.
- Peso da frase: **200 → 700**; peso do trecho destacado (`<em>`): 300 → 800.
- Caixa: **adicionado `text-transform: uppercase`** — transforma a frase em comando, como num cockpit competitivo.
- Espaçamento e linha ajustados para leitura rápida de relance.
- Frase inicial alterada de **"freie *mais cedo* na 3"** para **"freia *cedo* na 3"** (3 palavras, imperativo agressivo, mantém a curva-foco). Alteração feita em dois pontos para coerência:
  - HTML estático do bloco `b-coach` (linha 3567);
  - Objeto de dados do hero da volta padrão (linha 4354).

### Blocos secundários (não alterados nesta V1)
- Bloco Carro (motor / câmbio / óleo): **inalterado**.
- Bloco Pneus (4 pneus com PSI / desgaste / temp): **inalterado**.
- Bloco Stint, Stint-bar, Δ Acumulado, Combustível (gauge), Mapa, Vídeo: **inalterados**.
- Blocos Passagem, Frenagem, Vmin: **inalterados**.

### Layout geral
- A intervenção foi **cirúrgica** — só nos elementos centrais do cockpit (marcha + RPM + frase coach). Nenhuma reorganização de grid, nenhuma remoção de bloco, nenhum reposicionamento.
- O efeito esperado é: marcha vira o centro visual; coach soa como comando; RPM ganha presença; demais blocos continuam exatamente como estavam.

## 5. O que não foi alterado

| Item | Estado |
|---|---|
| Arquivo ativo `mockup-command-box-vista-piloto.html` no ambiente `vista-engenheiro` | **Intocado.** Hash continua `8095f968…`, 295.371 bytes, 38 blocos. |
| Backup `2751b58` (`_history/2026-05-13-command-box-pre-simplificacao/`) | **Preservado.** Hash `d2abc6ac…`, intacto desde o Stint 5A. |
| Versão simplificada antiga (`_history/2026-05-14-restauracao-candidato-reconstruido/`) | **Preservada.** Hash `139d7afc…`, intacta. |
| Cópia de referência do candidato reconstruído (`_history/2026-05-14-…`) | **Preservada.** Hash idêntico ao ativo. |
| Outros 5 ambientes isolados (`auditoria-estrutura`, `competent-volhard-b272c8`, `f4-triagem-video`, `rodada1-s1`, `tender-lalande-0f034a`) | **Não foram tocados.** |
| Registros no histórico do projeto | **Nenhum criado** (sem `commit`). |
| Envio ao repositório oficial | **Não feito** (sem `push`). |
| Submissão formal | **Não aberta** (sem pull request). |
| Incorporação à versão oficial | **Não feita** (sem `merge`). |
| Produção | **Não tocada.** |
| Outros arquivos `.html`/`.css`/`.js` do projeto | **Não tocados.** |

## 6. Riscos

| Risco | Existe? | Detalhe |
|---|---|---|
| Sobreposição de elementos por causa do aumento da marcha | **Baixo** | A coluna da marcha foi expandida no `grid-template-columns` (42 px → 102 px) para acomodar os 76 px do número. Em monitores ≥ 1280 px de largura a grade absorve sem sobreposição. Em telas estreitas pode pressionar a faixa de LEDs centrais — vale conferir no navegador. |
| Perda visual (algum bloco "sumir") | Nenhum bloco removido. Todos os 38 `id=` foram preservados. | Confirmado por contagem antes/depois. |
| Excesso de densidade na faixa central | **Médio** | Marcha e RPM ganharam massa visual juntos. Se ficar pesado, a próxima iteração V2 pode equilibrar peso (manter marcha em 76 px e voltar RPM para 28 px, por exemplo). |
| Regressão de telemetria mecânica | Nenhuma | Contagens de `vmin`, `pneus`, `motor`, `câmbio`, `óleo`, `Stint` ficaram iguais ao ativo (`49 / 42 / 18 / 9 / 9 / 42`). |
| Frase "freia cedo na 3" se sobrescrever por causa do JS | **Baixo** | A frase foi alterada tanto no HTML estático quanto no objeto de dados do hero — qualquer reidratação inicial mantém o novo texto. Comandos dinâmicos futuros (variação por curva, sinais good/bad) continuam funcionando porque só o conteúdo da string inicial foi trocado. |
| `text-transform: uppercase` quebrar palavras com acento ou números | Baixo | A frase atual ("freia cedo na 3") fica "FREIA CEDO NA 3" — sem acento, com numeral, tudo em caixa alta sem problema. Frases dinâmicas que tragam acentos serão exibidas em caixa alta pelo CSS. |
| Arquivo ativo ter sido tocado por engano | Não | Hash do ativo conferido após cada operação. Continua `8095f968…`. |

## 7. Link de validação

Servidor local **porta 8878**, servindo somente a pasta de auditoria isolada:

`http://127.0.0.1:8878/vista_piloto_ajuste_v1.html`

(Os outros servidores continuam ativos para comparação:)

- Mockup ativo atual (porta 8866): `http://127.0.0.1:8866/mockup-command-box-vista-piloto.html`
- Base `2751b58` + candidato reconstruído (porta 8877): `http://127.0.0.1:8877/base_2751b58.html` e `http://127.0.0.1:8877/candidato_reconstruido.html`

## 8. Próximo passo recomendado

**Validação visual pelo Flávio.** Abrir `http://127.0.0.1:8878/vista_piloto_ajuste_v1.html` no navegador e comparar com o mockup ativo (porta 8866).

Decidir uma das três coisas:

1. **Aprovou** → próximo Stint sob nova autorização: planejar promoção do ajuste V1 para arquivo ativo (mesma estrutura do que foi feito quando o candidato reconstruído virou ativo — preservando o ativo atual em pasta histórica).
2. **Aprovou parcialmente** → próximo Stint sob nova autorização: gerar V2 com ajustes finos pedidos (por exemplo, reduzir RPM, abrir mais espaço, mexer em outro bloco).
3. **Não aprovou** → próximo Stint: descartar o ajuste V1 (apagar a pasta de auditoria) ou guardar como referência e tentar outro caminho.

**Não recomendado neste momento:**

- abrir submissão formal (pull request);
- enviar ao repositório oficial (push);
- incorporar à versão oficial (merge);
- registrar no histórico (commit) — só fazer se o ajuste virar arquivo ativo num próximo Stint autorizado.
