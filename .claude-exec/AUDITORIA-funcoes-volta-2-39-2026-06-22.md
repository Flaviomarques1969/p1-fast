# AUDITORIA COM EVIDÊNCIA — as funções rodam mesmo na volta de 2:39? (22/06/2026)

Pedido: "audite com evidências se as funções estão realmente rodando utilizando a volta de 2:39".
Método: falsificação — para cada função, mostrar que a SAÍDA muda quando o DADO muda (se fosse número
fixo, não mudaria). Comando: `dotnet run --project P1Fast.Cockpit.SessaoReplay -- --auditoria`.

## 0. Procedência do dado (é a sessão real, não simulação)
- Arquivo: `.claude-exec/dados-pista/sessao-2026-06-21-1140-brasilia-COMPLETA.json` (16 MB)
- sha256: 5bac02ea841d5268c1b92aa0bb82cc39f219a07a61496789fd21d8781e182256
- `sim = False` (NÃO é simulação), id `sessao-2026-06-21T14-40-01-885Z`, 18,6 min, 1.942 amostras de
  motor + 27.310 de GPS.
- A volta de 2:39 é REAL: detector oficial de linha de chegada de Brasília → volta 2 = **2:39.60**
  (a volta 1, 3:14.95, é a saída/aquecimento).

## 1. Veredicto por função (evidência da rodada real)
| Função | Entrada real | Falsificação (muda com o dado?) | Veredicto |
|---|---|---|---|
| Luz de marcha | rpm pico real 5912 → Lit nível 6 | +400 → Overrev; 0 → Off | REAL (computa do rpm) |
| Alertas | água 55°C, rpm 5912 → nenhum | mesma amostra com água 85 → MOTOR QUENTE | REAL (lê a água) |
| Bolinha/ápice | lat −15.77310 lng −47.90044 (Brasília), raio 9,5m | longe = 16m, em cima = 0m | REAL (GPS de Brasília) |
| Em qual curva | GPS real → 8 de 8 curvas | GPS 5 km fora da pista → 0 curvas | REAL (geometria de Brasília) |
| Delta + coach | 2ª volta vs 1ª → RECORDE/BUSCAR LIMITE/MANTEVE (5 frases reais) | 10% + rápido → −1,88s; 10% + lento → +2,44s | REAL (compara velocidade) |

Bateria de testes automáticos: 256 (1 falha pré-existente PAN_04, vírgula no Mac). Cérebro compila 0/0.

## 2. O QUE É HONESTO DIZER (limites, sem maquiar)
- **As funções consomem a sessão inteira em movimento (3.499 pontos = as 2 voltas), não só o trecho
  isolado de 2:39.** A volta de 2:39 É usada — ela é a 2ª passagem (a mais rápida); o coach compara
  cada curva da 2ª volta com a 1ª (a referência). Por isso saiu "RECORDE": a 2ª volta foi mais rápida.
- **A frase "FREOU CEDO" mostrada no Incremento 4 era SIMULADA** (eu desacelerei a passagem de
  propósito, porque naquele momento eu olhava 1 curva só). NÃO era real. O coach REAL (sem simulação)
  é o do capstone: RECORDE / BUSCAR LIMITE / MANTEVE LINHA (2ª volta vs 1ª).
- **Campos que o aparelho não capturou viram "sem dado", não 0:** óleo (sensor ausente), EGT, marcha,
  erro de ECU não existem na captura T3000 desta sessão — as funções auditadas usam só os campos REAIS
  (rpm, água, lambda, bateria, bit de óleo).
- **Piso de ruído do delta ≈ 0,061s:** comparar uma passagem com ela mesma (velocidade variando) NÃO dá
  exatamente zero, por uma assimetria do cálculo aprovado (atual usa a média do par, referência usa o
  ponto). É fiel ao JS original; o efeito prático é que diferenças abaixo de ~0,06s não são confiáveis.
- **A bolinha auditada (raio 9,5m) é a curva mais fechada do trajeto em movimento** (1 ponto real de
  Brasília). As 8 curvas da segmentação usam os ápices do arquivo aprovado das barras (reais).
- **A TELA em si (WinUI) NÃO foi executada** — isto audita o CÉREBRO rodando sobre o dado real (no Mac).
  A tela acendendo só prova no notebook Windows.

## 3. Conclusão
As 5 funções rodam de verdade sobre o dado real da sessão de domingo (que contém a volta de 2:39), e
cada uma reage ao dado (falsificação confirmada). Os pontos simulados/padrão estão listados acima, sem
esconder. O que falta de prova é só a parte VISUAL (tela) e o empacotamento — no Windows.
