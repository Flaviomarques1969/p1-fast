# Ultima tarefa — Politica de atualizacao consistente entre 3 plataformas

## Pedido original (Flavio)
Propor a politica de atualizacao consistente entre notebook Windows (.exe C#), iOS (Swift) e
Command Box, ancorada no que ja existe no repo. Resolver a tensao offline (.exe sem nuvem na pista).
Leve e seguivel (equipe pequena), nao burocracia. Marcar o que e decisao do Flavio.

## Objetivo (1 frase)
Definir politica de PARIDADE entre 3 portes (JS/C#/Swift) com contrato versionado + fixtures
cross-plataforma + mapa de status, sem inventar estrutura nova.

## Criterio de conclusao
Politica concreta com fonte unica por tipo, versionamento de contrato, processo de propagacao,
tratamento offline e rastreabilidade, tudo citando arquivo real do repo.

## Plano
1. Verificar claims criticos do levantamento (shift-light C# vs JS, fixture gap, ADRs). FEITO.
2. Confirmar mecanismo de paridade Swift<->JS e PDF fixture JS<->C#. FEITO.
3. Redigir politica ancorada em ADR-023/025, fixtures, mensagens canonicas. FEITO.
4. Marcar decisoes do Flavio. FEITO.

## Ambiente alvo: desenvolvimento (proposta de politica, nenhuma alteracao de codigo/prod)
## Producao protegida: sim. Producao alterada: nao. Autorizacao prod: nao recebida (nao necessaria).

## Evidencia verificada (arquivo:linha)
- web/cockpit/live-data-bridge.js:33-82 (JS TEM modo torque peakTorqueRpm)
- windows/cockpit/P1Fast.Cockpit.Domain/LiveDataBridge.cs:20-21,117,123 (C# LiveLimits SO RedlineRpm; RpmToShift so % redline) -> DIVERGENCIA REAL
- ARCHITECTURE_DECISIONS.md:146 (mockup congelado byte-for-byte), :150 (smokes JS = contrato de teste do nativo, cada caso JS deve ter equivalente C#), :231-243 (ADR-025 Detector Swift = fonte da verdade; 3 portes podem divergir = divida arquitetural)
- web/cockpit/fixtures/stint-brasilia-3-laps.v1.json (schemaVersion 1.0.0) + README; so referenciada por JS fixtures README e UI MainWindow, NAO por teste de paridade cross-lang
- src/telemetry/t4000-packet-parser.js:218-230 vs windows/.../T4000PacketParser.cs:189-201 (PDF fixture 0x91/1937 DUPLICADA byte a byte, sem JSON unico)
- windows/.../T4000PacketParserTests.cs:1-2 ("23 facts xUnit equivalentes 1:1 aos smokes T4K") + T4000Simulator.cs:1-6
- ios/p1fast-core/README.md:55-104 (tabela de paridade Swift<->JS 1:1, 129 asserts) + Sources/P1FastSmoke/main.swift
- web/command-box/marcha-real.js:2,16 + frenagem-real.js:10-12 (adaptadores IMPORTAM o cerebro JS de producao, NAO duplicam) = excecao virtuosa
- web/cockpit/mensagens-pedagogicas.js:21 ("IDs canonicos espelha o JSON aprovado" = re-digitado) + _design-reference/versions/mensagens-*-aprovado-2026-05-27.json
- web/command-box/tipos-curva-brasilia.js:1-16 (8 curvas hardcoded ate tabela no banco; fonte = decisao literal Flavio 13/06)
- AMBIENTES_P1_FAST.md:30-34 (producao NAO autorizada, nenhum deploy sem comando explicito)
- STATUS.md:23,233,320 (MS-16 mockups entregues; MS-12 Box Cockpit/AirPlay NAO feito)
- .github/workflows/windows-cockpit.yml:94,134,168-171 (publish .exe self-contained win-x64 em iteracao)
- docs/FONTE_DADOS_AO_VIVO.md:1-40 (local renderiza, nuvem espelha; canal cockpit-bubi-live fonte unica ao vivo)

## Status: concluido (proposta de politica entregue via StructuredOutput)
