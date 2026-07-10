# DESENHO — Mapeamento automático de pista desconhecida (proposta pra aprovação do Flávio)

**Origem:** decisão do Flávio 2026-07-10, textual: *"se ele estiver rodando em uma nova pista,
ele vai mapeando a cada volta e criando uma nova pista com os trechos."*
**Status: PROPOSTA — nada codado. Aguarda aprovação (ou correção) do Flávio.**

## O problema de hoje
Fora da caixa geográfica de Brasília (`PistaBrasilia.cs`), o `GpsFiltroAoVivo` reprova todo fix
e o cérebro fica 100% cego em silêncio: sem volta, sem trecho, sem delta, sem recordes — o piloto
só vê "Sem GPS" sem saber por quê.

## O que o Flávio quer
Numa pista nova o cockpit **aprende sozinho**: descobre onde a volta fecha, corta a pista em
trechos, e passa a cronometrar/comparar como faz em Brasília — melhorando a cada volta.

## Desenho proposto (4 fases dentro do dia de pista, automáticas)

### Fase A — reconhecer "pista nova" e ser honesto (1ª volta)
- Fix 3D bom (hacc ok) FORA da caixa de Brasília → em vez de reprovar, entra o modo
  **MAPEANDO PISTA NOVA**: aviso persistente na região de status ("PISTA NOVA — mapeando, volta 1").
- Motor/velocidade/alertas funcionam normalmente (não dependem de pista). Delta/bolinha/recordes
  ficam adormecidos e a tela NÃO inventa número (§9).
- O disco já grava todos os fixes (nada muda na gravação).

### Fase B — descobrir o fecho da volta (2ª–3ª volta)
- Detector de laço: guarda a trilha decimada (~1 ponto/3 m, como o filtro já faz) e detecta o
  RE-CRUZAMENTO da própria trilha: passar a < 15 m de um ponto já visitado com heading na mesma
  direção (±30°). Primeiro re-cruzamento estável = candidato a fecho do circuito.
- A **linha de chegada aprendida** = segmento perpendicular ao heading no ponto de re-cruzamento
  mais RÁPIDO da volta (âncora na reta principal — mesma semântica da linha real de Brasília,
  que fica na reta). Confirma com 2 períodos de volta consistentes (±10%).
- A partir daí a barra de voltas e o cronômetro de volta funcionam (piso de plausibilidade da
  volta: o mesmo `VoltaMinimaPlausivelMs` — em pista nova, derivado do período observado).

### Fase C — cortar os trechos (3ª–4ª volta)
- Com 2 voltas fechadas, monta o perfil velocidade × distância-na-volta (média das voltas):
  - **ápice** = mínimo local de velocidade (mesma definição do TrechoDetector);
  - **fronteira de trecho** = ponto de velocidade máxima entre dois ápices (meio da "reta");
  - trechos viram a MESMA estrutura que hoje é hardcoded (`SegmentoPista`/marcos que o
    `TrechoDetector` consome) — o detector não muda, muda a ORIGEM dos segmentos.
- IDs estáveis por distância acumulada (t01, t02, …) — pra recordes e reação por trecho keiarem.
- Trechos **congelam** quando 2 cortes consecutivos derem o mesmo resultado (±20 m): depois
  disso não mudam mais no dia (estabilidade > perfeição; recalibrar é decisão de outro dia).

### Fase D — usar e lembrar
- Trechos congelados → delta/bolinha/luz de freio/reação por trecho ligam, com o rótulo honesto
  saindo do status ("PISTA NOVA — mapeada: 8 trechos").
- Persistência local (como recordes): `~/p1fast-sessoes/pista-<id>.json` com escrita atômica
  (`EscritaAtomica`), onde `<id>` = hash da caixa geográfica aprendida. Voltou à mesma pista
  noutro dia → carrega e já começa com trechos + recordes daquela pista.
- Recordes keados por pista (`ArmazemRecordes` por `pistaId`, hoje fixo "Brasilia").

## Regras duras propostas
1. **Brasília continua hardcoded e VENCE** — dentro da caixa dela, nada muda (não regride o
   que está validado pra campo).
2. **Honestidade**: enquanto mapeia, a tela diz que está mapeando; delta só aparece com trecho
   congelado; nunca número inventado.
3. **Tudo local** (como os recordes) — nuvem não é pré-requisito.
4. **Cérebro puro**: todo o mapeamento vive no Domain (testável com trilhas sintéticas e com o
   .jsonl real de 21/06 "deslocado" pra fora de Brasília — teste de regressão barato).

## Decisões que só o Flávio fecha (responder pra destravar)
- **D1 — mínimo de voltas pra CONGELAR os trechos:** proposta = 2 voltas consistentes (delta
  liga na 4ª–5ª volta do dia). Alternativa mais conservadora: 3.
- **D2 — a pista aprendida vale entre DIAS?** Proposta: sim (persistida local). Alternativa:
  só no dia (reaprende sempre).
- **D3 — kart ou só carro?** O desenho assume o Bubi (RaceBox 25 Hz, voltas > 40 s). Pistas de
  kart (voltas ~30 s, curvas coladas) podem precisar de limiares próprios — fica pra depois?

## Execução sugerida (quando aprovado)
Nova onda de 3 janelas: (1) detector de laço + linha aprendida; (2) corte/congelamento de
trechos + persistência; (3) fiação UI honesta + recordes por pista. Mesmo protocolo da onda 1
(worktree, evidência, teste de regressão, auditoria do coordenador).
