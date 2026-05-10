# Command Box — fixtures de stint

Massa de teste compartilhada entre as plataformas que renderizam ou consomem dados do Command Box (vista piloto). Mesmo arquivo serve cliente Swift (iOS), C# (.NET 8 / WinUI 3), JS (web/cockpit) e qualquer outro consumidor que decode JSON.

## Por que existe

O mockup canônico `_design-reference/mockup-command-box-vista-piloto.html` tem `FAKE_LAPS` inline em JS, com narrativa rica de 3 voltas (V6 média, V7 ruim, V8 boa) + out-lap (V5 aquecimento). Esse dado é o ground truth visual de como o Command Box deve se comportar em cenários típicos. Pra alimentar testes automatizados em qualquer linguagem, a massa foi extraída pra JSON neutro versionado aqui.

Sempre que uma sessão precisar reproduzir o que o mockup mostra (em fact xUnit, smoke Swift, simulação ao vivo, etc), parte deste arquivo. Não inventar dado novo nem regenerar.

## Arquivo canônico

[`stint-brasilia-3-laps.v1.json`](stint-brasilia-3-laps.v1.json) — ~37 KB, 689 linhas.

`v1` no nome = compromisso com versionamento explícito. Mudanças de shape geram `.v2.json` em paralelo, NÃO sobrescrevem este. Outras sessões podem manter parsing pinado em `v1` enquanto migram.

## Conteúdo

### Top-level
- `track` — dados estáticos da pista de Brasília: 8 curvas com `centerT` (fração da volta 0..1) + valores ideais (`entryKmh`, `brakeM`, `vminKmh`, `exitKmh`); viewBox 823×799; `lapBaselineSec=92.0`; `pbEverSec=91.95`
- `stintHistory.entries` — 12 voltas do stint completo. Voltas 1-4 são histórico simulado (rampa de aquecimento, sem corners); volta 5 é out-lap rico (corners duplicados de V6); voltas 6/7/8 são as ricas; voltas 9-12 são futuras (`deltaSec=null`). Campo `richLapIdx` aponta pra `laps[N]` quando há detalhe disponível.
- `limits.channels` — limites por canal de telemetria do carro com 6 níveis cada (`min`, `cold`, `lowOk`, `highOk`, `hot`, `max`). T4000 é fonte canônica pra `tempMotor` e `pressOleo`; cadastro do carro preenche o resto. `<= min` ou `>= max` = zona crítica (pisca shift-light wash branco).
- `fuel` — config do gauge: `tankMaxL=40`, `criticalPct=0.15` (alerta crítico < 15% do tanque).
- `laps[]` — 4 voltas ricas (V6, V7, V8, V5 out-lap, nessa ordem).

### Por volta (`laps[N]`)
- Identidade: `lapNumber`, `type` (`media|ruim|boa|aquecimento`), `tirePhase` (`corrida|aquecimento`), `timeStr`, `deltaTotalStr`, `score`, `tireWearPct`, `narrativeNote` (PT-BR explicando o que aconteceu)
- Plano: `plan.goal`, `plan.focusSegment`, `plan.lapsUntilPbStr`
- IA P1 Coach: `ai.phrase`, `ai.targetCurveIdx`, `ai.command`, `ai.lessonTitle`, `ai.lessonDescription`, `ai.progressPct`, `ai.analysis`
- HUD: `hero.speedKmh`, `hero.gear`, `hero.rpm`, `hero.tempMotorC`, `hero.sectorStr`, `hero.lambda`
- Trajetória live (modula renderer ghost): `trajectory.erratic`, `trajectory.widen`, `trajectory.cleanRatio`, `trajectory.demoOffTrack`
- Carro: `carStart` + `carEnd` (snapshots — interpolação fica com cliente)
- Pneus: `tiresStart[4]` + `tiresEnd[4]` (DE/DD/TE/TD)
- Combustível: `fuelStartL`, `fuelEndL`, `fuelConsumedThisLapL`
- Corners: `corners[8]`

### Por corner (`laps[N].corners[i]`)
- Identidade: `curveIdx` (0..7), `name` (C1..C8), `narrativeNote`
- 3 fases: `entry`, `apex` (com `offsetM` adicional), `exit` — cada uma com `speedKmh`, `deltaKmhStr` (string com sinal), `tone` (`good|bad`), `gear`
- Verdicts: `brakingId` (`no-ponto|cedo|tarde|timido|violento|aliviou|travou|perfeito`), `vminId` (`no-ponto|baixo|alto|antecipou|atrasou`), `passage` (label PT-BR + tone + delta acumulado em segundos)
- Séries de 5 amostras pelo trecho:
  - `speedSeries` = `[entry, mid_entry_apex, apex, mid_apex_exit, exit]` em km/h
  - `deltaSeries` = mesmos 5 pontos em segundos cumulativos vs ghost. `deltaSeries[4]` = delta total do corner.

## Narrativa das 3 voltas ricas

**V6 — média (volta 6, +0.78s)**: dia comum com mistura. Acerta C1/C4/C6/C8 (limpas), erra C2 (cedo + vmin alto), C3 (tímido), C5 (cedo), C7 (tarde). Carro nominal subindo. P1 Coach manda "freie mais cedo na 3".

**V7 — ruim (volta 7, +1.85s)**: piloto atacou demais e fundiu o ritmo. Já entra na volta com motor em 121°C (`>=max=120`) e câmbio 138°C (próximo ao max=140) — pisca vermelho desde o início. TE superaquecida (`>max=115`), TD com pressão crítica (`<min=1.6`). C5 piloto travou roda + DEMO off-track (perdeu 0.45s só nessa). Combustivel +18% sobre média. P1 Coach dispara alerta "respira — você atacou demais".

**V8 — boa (volta 8, −0.11s, PB ever)**: ritmo limpo, 4 ápices PERFEITOS (C1/C4/C8 + linha colada no ghost). Tempo bate PB do stint E vira PB ever (1:31.89 < PB anterior 1:31.95). Combustivel ENTROU em alerta crítico (5L = 12.5% < 15%). Pneus se recuperaram do estresse de V7. P1 Coach: "ritmo bom — repete".

**V5 — out-lap aquecimento (volta 5, +16.50s)**: pneus saem da garagem a ~35°C, terminam ~58°C. `tirePhase=aquecimento` suprime alerta `critical-cold` de pneu (frio é esperado). Sem narrativa de corner própria — corners duplicados de V6 (decisão pragmática pra cliente não ter que resolver referência cruzada).

## Como consumir

### C# (.NET 8 + System.Text.Json)
```csharp
using System.Text.Json;
using System.Text.Json.Serialization;

public record StintFixture(
    [property: JsonPropertyName("schemaVersion")] string SchemaVersion,
    [property: JsonPropertyName("fixtureId")]     string FixtureId,
    [property: JsonPropertyName("track")]         TrackData Track,
    [property: JsonPropertyName("stintHistory")]  StintHistory StintHistory,
    [property: JsonPropertyName("limits")]        LimitsConfig Limits,
    [property: JsonPropertyName("fuel")]          FuelConfig Fuel,
    [property: JsonPropertyName("laps")]          IReadOnlyList<Lap> Laps);

var json = File.ReadAllText("web/cockpit/fixtures/stint-brasilia-3-laps.v1.json");
var fixture = JsonSerializer.Deserialize<StintFixture>(json)!;
```

Em xUnit, pode parametrizar com `[MemberData]` apontando pra cada lap ou cada corner — cada caso PT-BR vira um Theory.

### Swift (Foundation JSONDecoder)
```swift
let url = Bundle.module.url(forResource: "stint-brasilia-3-laps.v1", withExtension: "json")!
let data = try Data(contentsOf: url)
let fixture = try JSONDecoder().decode(StintFixture.self, from: data)
```

### JS (cockpit web)
```js
const res = await fetch('/web/cockpit/fixtures/stint-brasilia-3-laps.v1.json');
const fixture = await res.json();
```

## O que NÃO está aqui (e por quê)

- **Geometria SVG da pista** (path do traçado, posicionamento dos pontos no viewBox): vem de `_design-reference/assets/pistas/premium-styles/atelier.svg` ou de `seed-tracks.js`. Esta fixture só carrega `centerT` por curva — geometria é responsabilidade do cliente.
- **Curvas SVG do widget VMIN** (`live` arrays de pontos `[[-80,148],...]`): são UI-specific do mockup (path SVG do gráfico). Cliente que renderiza Vmin diferente não precisa.
- **`VMIN_GHOST`** (curva de referência do widget): mesmo motivo — UI específica.
- **`CHECKLIST_SAIDA` e `CHECKLIST_CHEGADA`**: lógica de stint (pré-saída → pista → resfriamento → pós-chegada), não é massa de telemetria. Vai numa fixture separada quando o fluxo de stint estiver fechado.
- **Função `_mc()` e helpers de interpolação**: lógica do cliente, não dado.

## Atalhos do mockup original (referência)

Quando rodando o mockup HTML em `_design-reference/mockup-command-box-vista-piloto.html`:
- `n` — avança volta (out-lap → V6 → V7 → V8 → out-lap...)
- `1` — pula direto pra V6 (média)
- `2` — pula direto pra V7 (ruim)
- `3` — pula direto pra V8 (boa)
- `0` — pula direto pra out-lap aquecimento

Esse mesmo cycle deve ser reproduzível em qualquer plataforma carregando voltas via `richLapIdx` do `stintHistory`.

## Versionamento

`schemaVersion` segue [SemVer](https://semver.org/lang/pt-BR/):
- **major** (`2.0.0`): breaking change de shape (campo renomeado, removido, ou tipo diferente)
- **minor** (`1.1.0`): campo novo opcional adicionado, retro-compatível
- **patch** (`1.0.1`): correção de valor de dado (typo numérico, narrativa rebatida)

Mudanças minor/patch ficam neste arquivo. Mudanças major criam `.v2.json` ao lado, e este permanece intocado até deprecação combinada.

## Próximos arquivos provisionados (não criados ainda)

- `vista-engenheiro.v1.json` — quando a vista engenheiro do Command Box for mockada
- `replay-stint.v1.js` — helper opcional pra reproduzir a fixture como stream 10 Hz (útil pra alimentar canal Realtime de teste)
