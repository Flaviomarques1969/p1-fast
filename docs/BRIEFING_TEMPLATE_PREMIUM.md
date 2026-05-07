# Briefing Template — Trabalho Premium com Agentes IA

Padrão de briefing para extrair qualidade premium de qualquer agente
(Claude Code, ChatGPT, Cursor, Gemini) ou pra usar com designer/dev humano.

Derivado da sessão de 2026-05-07 que produziu o atelier visual da pista
de Brasília (`assets/pistas/premium-styles/atelier.svg`).

---

## O template (copia, cola, preenche)

```
CONTEXTO
- Projeto: [nome + 1 frase do que é]
- Já existe: [arquivos, repos, dados, sistemas que devo respeitar]
- Stack: [linguagem, framework, plataforma, ambiente]

OBJETIVO
- O que quero ver no final: [resultado visual/funcional, em 2-3 linhas]
- Para quem é: [usuário final + contexto de uso]
- Referência estética/funcional:
  ["estilo X de Y" — ex: "Patek Philippe", "Apple Keynote",
   "Octane Magazine", "FOM TV graphics", "Stripe dashboard"]

CONTRATO
- Você tem autonomia em: [decisões técnicas, escolha de bibliotecas,
  paths de arquivo, organização de código]
- Pergunta antes de: [mexer em X, mudar arquitetura, deletar Y,
  introduzir nova dependência]
- Seja honesto se: [não tiver dado real / não conseguir fazer algo /
  estiver inventando / a melhor solução fugir do que pedi]
- Modo de trabalho: iterativo. Faça → me mostre preview → eu corrijo.

QUALIDADE
- Não quero "MVP funcional". Quero qualidade de [referência].
- Se a primeira tentativa for mediana, jogue fora e refaça.
- Pequenos detalhes importam (tipografia, sombras, gradientes,
  hierarquia visual, micro-interações, timing de animação).
```

---

## Os 5 princípios que fazem isso funcionar

### 1. Itere com feedback visual concreto
Não descreva em palavras o que tá errado. **Mostre.**
- ✅ "Tem um bico aqui [screenshot com círculo vermelho]"
- ✅ "Esse trecho tá esquisito, deveria ser fluido"
- ❌ "Acho que a curva ficou um pouco mais aberta do que eu gostaria, talvez você possa ajustar a curvatura sem perder a referência geométrica original mas suavizando o ponto onde..."

### 2. Seja direto quando algo não tá bom
Três palavras: "**não ficou premium**". Isso força refazer, não polir o medíocre.
- ✅ "Tá mediano, joga fora e refaz"
- ✅ "Ainda longe do que eu quero"
- ❌ Aceitar a primeira entrega "porque o agente já tentou bastante"

### 3. Dê autoridade total quando confiar
Briefing tímido produz resultado tímido. Quando o agente já entendeu o
contexto, libere:
- ✅ "Autorizado, pode fazer"
- ✅ "Faz tudo e depois ajustamos"
- ✅ "Tem total autonomia"

### 4. Peça opções quando estiver indeciso
Use o agente como conselheiro, não só executor:
- ✅ "Como deixar isso premium? Me dá 3 direções"
- ✅ "Qual a melhor IA pra isso?"
- ✅ "Qual abordagem você recomenda e por quê?"

### 5. Traga contexto funcional, não só estético
Detalhes operacionais mudam o design:
- ✅ "Vai ter um ghost rodando em paralelo" → muda a hierarquia toda
- ✅ "O usuário vai olhar isso de relance, não estudar"
- ✅ "Isso roda em iPhone, precisa caber 60fps"
- ❌ "Faz bonito" sem dizer pra que serve

---

## O que evitar

| Anti-padrão | Por quê falha | O que fazer |
|---|---|---|
| **"Faz bonito"** sem referência | Resultado genérico, sem alma | Sempre cite uma referência ("estilo X") |
| Aceitar a primeira entrega | Você acha o ok, não o ótimo | Olhe 3 vezes antes de aprovar |
| Acumular feedback | "Tem 5 problemas" embaralha | Resolva um, veja, próximo |
| Briefing-checklist longo | "X, Y, Z, W, V" → tudo medíocre | Foque: "X muito bem feito, depois Y" |
| Especificar a solução técnica | Trava o agente | Diga o problema, não a solução |

**Exemplo do último ponto:**
- ❌ "Use suavização Bezier de 3º grau pra eliminar o vértice anguloso na coordenada (234, 513)"
- ✅ "Tá com bico aqui, suaviza"

Deixa o agente escolher como.

---

## Adaptações por contexto

### Em outras IAs (ChatGPT, Gemini, Cursor)
Mesmo template funciona. **Iteração visual** é o ponto crítico.
Em ChatGPT: anexe screenshots. Em Cursor: peça previews.

### Em briefing pra designer/dev humano
Idem. O pattern é universal — "contexto + objetivo + autonomia +
qualidade + iteração" funciona pra qualquer trabalho criativo.

### Em outro projeto Claude Code
Cole este template no `CLAUDE.md` do projeto pra o agente já começar
afinado em "modo premium".

---

## Sinais de que o briefing tá funcionando

- O agente faz **perguntas** antes de executar (significa que entendeu
  que tem espaço pra discordar/escolher).
- O agente propõe **alternativas** quando você não foi específico
  (em vez de chutar uma).
- O agente **avisa** quando tá inventando dado ou usando defaults
  (transparência).
- Você **enxerga progresso visual** a cada 2-3 trocas, não a cada 20.
- Você consegue **dizer "não" rápido** sem culpa.

## Sinais de que tá indo mal

- Agente entrega tudo de uma vez, sem iteração.
- Você fica "polindo" entrega medíocre porque já investiu tempo.
- Agente nunca pergunta nada (executa cego = vai errar).
- Resultado parece "qualquer projeto" — falta personalidade.
- Você tá descrevendo soluções técnicas em vez de problemas.

---

## Versão curta pra colar em CLAUDE.md de novos projetos

```markdown
## Briefing premium — modo de trabalho com este projeto

Quando eu pedir trabalho criativo (design, UI, conteúdo, doc visual),
opere assim:

1. Pergunte contexto antes de executar se algo for ambíguo.
2. Proponha 2-3 alternativas quando direção não estiver clara.
3. Trabalhe iterativamente: pequena entrega → preview → correção.
4. Se a primeira tentativa for mediana, jogue fora e refaça —
   não polir.
5. Avise quando inventar dado ou usar defaults.
6. Pequenos detalhes importam: tipografia, espaçamento, hierarquia,
   timing, micro-interações. Não corte canto neles.
7. "MVP funcional" não basta. Quero qualidade de [referência aqui].
```
