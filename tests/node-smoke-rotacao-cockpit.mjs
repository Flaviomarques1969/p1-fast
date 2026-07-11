#!/usr/bin/env node
// TRAVA — arquitetura de rotação do cockpit do piloto (iPhone) é UMA só.
//
// Real 2026-07-11: um merge misturou metade de cada arquitetura de rotação e o
// cockpit do Flávio abriu certo e entortou em seguida (dupla rotação). A
// arquitetura OFICIAL tem 4 peças que precisam vir SEMPRE do mesmo lado:
//   1. PERMISSÃO: app travado em PÉ (project.yml/Info.plist só Portrait);
//   2. GATE: OrientationGate publica o ângulo do giro (gravidade, na mão);
//   3. APRESENTAÇÃO: ContentView monta o cockpit como overlay RECEBENDO o ângulo;
//   4. TELA: CockpitPilotoView gira o conteúdo pelo ângulo recebido.
// Este teste reprova qualquer mistura. Catraca: só aperta, não afrouxa.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const ler = (p) => readFileSync(join(raiz, p), 'utf8');
let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!cond) falhas++;
};

// 1. PERMISSÃO — app travado em pé (a rotação do cockpit é "na mão").
const projectYml = ler('ios/p1fast-ios/project.yml');
ok(!/UIInterfaceOrientationLandscape/.test(projectYml),
  'project.yml sem Landscape (app travado em pé — ROTACAO-01)');
const infoPlist = ler('ios/p1fast-ios/Sources/App/Info.plist');
ok(!/Landscape/.test(infoPlist),
  'Info.plist sem Landscape (ROTACAO-02)');

// 2. GATE — sem AppDelegate de rotação nativa (arquitetura descartada 11/07).
ok(!existsSync(join(raiz, 'ios/p1fast-ios/Sources/App/AppDelegate.swift')),
  'sem AppDelegate.swift de rotação nativa (ROTACAO-03)');
const gate = ler('ios/p1fast-ios/Sources/App/OrientationGate.swift');
ok(/landscapeAngle/.test(gate) && !/supportedOrientations/.test(gate),
  'OrientationGate publica landscapeAngle e não usa supportedOrientations (ROTACAO-04)');

// 3. APRESENTAÇÃO — ContentView passa o ângulo pro overlay do cockpit.
const contentView = ler('ios/p1fast-ios/Sources/Views/ContentView.swift');
ok(/CockpitPilotoView\(angle:/.test(contentView),
  'ContentView monta CockpitPilotoView(angle:) — overlay com ângulo (ROTACAO-05)');
ok(!/vSize == \.compact[\s\S]{0,80}CockpitPilotoView\(\)/.test(contentView),
  'ContentView sem o gatilho antigo por vSize compacto sem ângulo (ROTACAO-06)');

// 4. TELA — CockpitPilotoView aceita o ângulo.
const cockpitView = ler('ios/p1fast-ios/Sources/Views/CockpitPilotoView.swift');
ok(/angle/.test(cockpitView),
  'CockpitPilotoView recebe/usa o ângulo (ROTACAO-07)');

console.log(falhas === 0 ? '\nrotacao-cockpit: tudo verde' : `\nrotacao-cockpit: ${falhas} falha(s)`);
process.exit(falhas === 0 ? 0 : 1);
