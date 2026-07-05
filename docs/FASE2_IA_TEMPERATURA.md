# Fase 2 — a "parte inteligente" das mensagens (IA de padrão de temperatura)

**Estado:** IMPLEMENTADO em DEV, testado (não está no ar, não tocou produção).
**Base:** Fase 1 (`origin/sync/notebook-dia-de-pista-2026-06-23`). Branch: `claude/fase2-ia-temperatura`.
**Autor:** iMac (Claude), 05/07/2026. Autorização do Flávio: "vai até o fim e implementa tudo, no final audita e corrige".

## 1. O que é (em linguagem de negócio)

Antes: um número-limite fixo mandava o aviso "Temperatura Motor Subindo" (era 70°C). Isso saiu na Fase 1.
Agora: a inteligência **aprende a temperatura normal do carro** e avisa quando ela sobe **fora do padrão daquele carro**, de forma consistente — não por um número cravado.

O mesmo modelo serve pra **motor, pneu e câmbio** (e o que vier). Só o **motor entra em uso agora** (o sensor de água já existe). Pneu e câmbio ficam **prontos e desligados** — no dia em que o sensor for instalado, ligam sozinhos.

Quatro princípios (spec do Flávio):
1. **Aprendizado contínuo** — aprende o tempo todo, sem número fixo de voltas; nunca trava.
2. **História gravada** — guarda a "máxima normal" do carro pra sobreviver entre sessões.
3. **Padrão de referência** — parte de uma máxima normal semente (Bubi/água: **62°C**) antes de ter histórico.
4. **Ajuste pelo ambiente** — o aprendizado do dia já embute quente/frio; um offset de ambiente fica preparado pra sensor futuro.

Bandas do motor (Bubi): **normal ~62°C → avisa "Subindo" a 65°C (+3) → trava dura "Motor Quente" a 70°C**.
A trava dura (70°C) é **independente** da IA e sempre dispara — é a rede de segurança.

## 2. Mapa dos casos reais e o fluxo de cada um

| Caso | Sensor hoje | O que entra | Onde grava histórico | Como decide normal × fora | Aviso no cockpit |
|---|---|---|---|---|---|
| **Motor (água)** | ✅ existe | `WaterTempC` + rpm + relógio | `AprendizadoTemperatura` (motor) → snapshot | máxima normal aprendida + 3°C, persistindo ≥3s | **"Temperatura Motor Subindo"** (super) |
| **Motor quente (trava dura)** | ✅ | `WaterTempC` | — (limiar fixo) | água ≥ 70°C | **"Motor Quente"** (super, modo crítico) |
| **Pneu aquecendo** | ⏳ falta sensor | `TireTempC` (null hoje) | `AprendizadoTemperatura` (pneu) | mesma IA; hoje null → nada dispara | "Pneu Aquecendo" (preparado) |
| **Pneu quente (2 níveis por tipo)** | ⏳ falta sensor | `TireTempC` | config `AprendizadoLimites` | radial 185: 95/105 · semi-slick 195: 105/115 | "Pneu Quente" (crítico já existe; atenção = 1 alerta a criar) |
| **Câmbio aquecendo** | ⏳ falta sensor | `CambioTempC` (null hoje) | `AprendizadoTemperatura` (câmbio) | mesma IA; hoje null → nada dispara | "Câmbio Aquecendo" (preparado) |
| **Óleo (temperatura)** | ❌ sem campo/sensor | — | — | ÓLEO QUENTE saiu na Fase 1; sem sensor | (fora de escopo até sensor + decisão) |
| **Carro sem histórico ainda** | — | qualquer | usa a **semente de referência** | limite = referência + 3°C | avisa desde a 1ª volta (com semente) |
| **Carro com histórico** | — | qualquer | usa a máxima aprendida | limite = máxima normal + 3°C | avisa relativo ao padrão do carro |
| **Dia quente / frio** | — | temperatura do dia | aprendizado do dia (τ) | máxima normal sobe/desce com o dia | sem alarme falso (adapta) |

**Fluxo do motor, passo a passo (o que roda a cada amostra):**
1. `CockpitOrchestrator.IngestMotor(rpm, alerta, tSeg)` recebe a amostra viva (mesma da Fase 1).
2. Chama `AlertasCriticos.IngestT4000(alerta, tSeg)`.
3. `AvaliarT4000` roda as travas duras (inclui **Motor Quente ≥70**).
4. `AplicarHisterese` (Fase 1: óleo/mistura).
5. **`AplicarAprendizado` (Fase 2):** alimenta o aprendiz da água; se a água ficou acima de (máxima normal + 3°C) por ≥3s **e** não é Motor Quente → levanta **"Temperatura Motor Subindo"**. Pneu/câmbio idem, mas o sensor é null → não muda nada.
6. `Set` reconcilia — quando a água normaliza, o aviso **sai sozinho** (não trava).

## 3. Onde cada coisa mora (reaproveitando a Fase 1)

- **NOVO** `windows/cockpit/P1Fast.Cockpit.Domain/AprendizadoTemperatura.cs` — o aprendiz genérico (motor/pneu/câmbio). Estado encapsulado + Exportar/Importar (mesmo padrão de `web/cockpit/aprendizado-tempo-passagem.js`).
- **ALTERADO** `.../AlertasCriticos.cs` — `AprendizadoConfig`/`AprendizadoLimites` (config por canal), o `AlertasCriticos` passa a **possuir os 3 aprendizes**, `AplicarAprendizado` no `IngestT4000`, e `Exportar/ImportarAprendizado` (história gravada). O catálogo e as travas duras da Fase 1 **não mudaram**.
- **ALTERADO** `.../CockpitOrchestrator.cs` — pontes `Exportar/ImportarAprendizado` + leitura `MotorMaximaNormalC`/`MotorConfianca` (pra telemetria/UI). A gravação em disco mora na camada do app (notebook).
- **NOVO** testes: `AprendizadoTemperaturaTests.cs` (12) + 7 em `AlertasCriticosTests.cs`.
- **Encaixe da Fase 1:** o alerta `MOTOR_AQUECENDO` ("Temperatura Motor Subindo") já existia no catálogo **sem regra de disparo** — a Fase 1 deixou o gancho de propósito. A Fase 2 só ligou a regra.

## 4. Parâmetros configuráveis (nada cravado no código) — valores sugeridos

Por canal (`AprendizadoConfig`, default = motor/Bubi):

| Parâmetro | Default motor | O que faz |
|---|---|---|
| `ReferenciaMaximaNormalC` | **62** | máxima normal semente antes de histórico |
| `DeltaSubindoC` | **3** | quantos °C acima do normal dispara o aviso |
| `PersistSubindoS` | **3** | segundos contínuos acima pra confirmar (ignora pico) |
| `TetoAprendidoC` | **70** (=Motor Quente) | não aprende superaquecimento real como "normal" |
| `TauSobeS` / `TauSobeMinS` | **30 / 2** | rapidez de aprender um normal mais alto (rápido imaturo → estável maduro) |
| `TauDesceS` | **300** | rapidez de "esquecer" pra baixo (lento, evita alarme falso) |
| `DtMaxS` | **5** | teto do intervalo entre amostras (pausa longa não vira salto) |
| `AmostrasConfianca` | **300** | amostras pra confiança plena (informativo) |
| `AmbienteOffsetC` | **0** | ajuste de ambiente (preparado; liga com sensor/entrada) |

Pneu quente por tipo (`AprendizadoLimites`, preparado): radial 185 = **95/105**; semi-slick 195 = **105/115**.
Pneu/câmbio aprendizado: referência **90 / 110**, delta **5** (provisório — calibrar com sensor).

## 5. Riscos e o que precisa de decisão do Flávio

- **Calibração dos números do Bubi (⚠️ importante):** a referência 62°C, o +3°C e os τ são **defaults conservadores**, não medidos. Precisam ser afinados com o dado real do Bubi (mesma pendência já anotada: "marcha lenta real do Bubi"). São todos configuráveis.
- **Aviso "subindo" exige rpm (motor rodando).** A trava dura (Motor Quente) não exige. Se o sensor de rpm falhar, o aviso antecipado fica mudo, mas a segurança dura continua. OK?
- **Pneu quente 2 níveis:** o nível **crítico** cabe no alerta atual; o nível **atenção** precisa de **1 alerta novo no catálogo** — deixei preparado na config e só crio quando o sensor chegar (evita mexer no catálogo por uma função desligada). Confirmar quando for a hora.
- **Óleo:** ÓLEO QUENTE (temperatura) saiu na Fase 1 e não há campo/sensor de temperatura de óleo — fora de escopo até haver sensor + sua decisão.
- **JS de referência (`web/cockpit/alertas-criticos.js`):** já estava divergente do C# desde a Fase 1 (a Fase 1 só mexeu no .exe). Não mexi nele. Se quiser o JS espelhando a Fase 2, é um passo à parte.
- **Persistência em disco:** a API de gravar/restaurar o aprendizado existe; **ligar o arquivo** (salvar ao fechar / carregar ao abrir a sessão) é trabalho do lado do notebook (WinUI), que não compila neste iMac.
- **Produção:** nada tocado. Isto é DEV. Pra ir ao ar, precisa do notebook compilar o .exe e da sua frase `MIGRAR PARA PRODUÇÃO`.

## Prova (rodada neste iMac)

- `dotnet build` do domínio: **0 erro, 0 aviso**.
- `dotnet test` (com `DOTNET_ROLL_FORWARD=Major`, pois só há runtime .NET 10): **396/396 verdes** (377 da Fase 1 preservados + 19 novos da Fase 2).
- `node tests/node-smoke-alertas-criticos.mjs`: **25/25** (JS intacto).
