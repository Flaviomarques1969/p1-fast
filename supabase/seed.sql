-- ═══════════════════════════════════════════════════════════
-- supabase/seed.sql — dados canônicos globais (idempotente)
-- ═══════════════════════════════════════════════════════════
-- Aplicado AUTOMATICAMENTE por `supabase db reset` (local) e MANUAL
-- via `psql -f supabase/seed.sql` (prod). Não roda em migration; é
-- separado pra permitir reset sem perder schema.
--
-- Conteúdo: catálogo GLOBAL (sem time_id) — pistas, layouts, segments,
-- marcos, parciais. Reflete `src/domain/seed-tracks.js` (Brasília) +
-- `src/data/schemas.js` (categorias/tipos canônicos).
--
-- UUIDs hardcoded determinísticos pra idempotência cross-environment:
--   ON CONFLICT DO NOTHING em todos os inserts. Re-rodar é seguro.

-- ─── Brasília (Autódromo Internacional de Brasília — Nelson Piquet) ──
-- IDs derivados de namespace fixo "p1-fast/tracks/<slug>" pra estabilidade.
-- Layout principal calibrado pelo path GPS do Flávio (volta 5, 171.038s).

insert into public.tracks (id, apelido, nome_oficial)
values (
  '11111111-b001-0000-0000-000000000001',
  'Brasília',
  'Autódromo Internacional Nelson Piquet'
)
on conflict (id) do nothing;

insert into public.track_layouts (id, track_id, nome, parciais, svg_path, linha_chegada)
values (
  '11111111-b001-1000-0000-000000000001',
  '11111111-b001-0000-0000-000000000001',
  'Principal',
  $$[
    {"id":"P1","nome":"Parcial 1","tStart":0.00,"tEnd":25.00,"apelido":"Saída do box"},
    {"id":"P2","nome":"Parcial 2","tStart":25.00,"tEnd":50.00,"apelido":"Junção"},
    {"id":"P3","nome":"Parcial 3","tStart":50.00,"tEnd":75.00,"apelido":"Bruxa"},
    {"id":"P4","nome":"Parcial 4","tStart":75.00,"tEnd":100.00,"apelido":"Placar → chegada"}
  ]$$::jsonb,
  -- Path SVG da volta 5 do Flávio (viewBox 823x799).
  'M 420.20 707.58 L 242.63 705.75 L 223.63 704.27 L 206.67 699.64 L 190.46 690.06 L 177.44 675.92 L 163.53 640.49 L 173.07 615.32 L 177.09 595.50 L 181.56 552.34 L 189.99 507.41 L 195.17 485.19 L 201.93 462.25 L 207.99 438.19 L 229.60 366.52 L 237.64 341.92 L 252.10 290.03 L 260.17 264.58 L 279.72 194.33 L 291.15 161.70 L 294.72 156.29 L 298.66 150.33 L 311.63 145.96 L 326.58 143.68 L 343.19 148.38 L 358.95 155.60 L 374.08 164.69 L 388.56 176.62 L 401.91 190.62 L 426.33 224.01 L 454.76 257.96 L 469.70 274.35 L 488.13 287.86 L 508.65 299.03 L 530.47 307.88 L 553.93 313.11 L 602.62 318.12 L 625.66 321.92 L 645.47 326.63 L 661.43 333.14 L 674.27 342.65 L 683.96 355.44 L 688.29 370.67 L 686.56 387.23 L 679.94 402.31 L 668.35 415.01 L 653.49 424.27 L 635.14 427.77 L 615.99 423.99 L 599.32 414.02 L 563.03 395.14 L 544.62 386.15 L 524.16 377.79 L 502.83 371.66 L 478.87 368.78 L 455.47 367.00 L 432.13 368.11 L 407.30 371.47 L 382.97 378.12 L 335.78 393.87 L 314.58 402.85 L 295.48 415.65 L 279.26 431.18 L 265.73 450.19 L 255.25 471.55 L 248.52 494.81 L 234.11 513.72 L 238.41 537.37 L 234.92 549.83 L 233.49 560.58 L 237.93 572.18 L 246.95 583.62 L 259.77 593.13 L 276.11 598.40 L 327.75 611.39 L 528.57 671.64 L 542.60 672.98 L 556.32 670.11 L 567.69 660.39 L 574.68 647.16 L 575.82 631.31 L 573.66 615.56 L 566.35 600.49 L 554.99 587.43 L 541.29 575.59 L 513.98 548.01 L 498.16 534.88 L 478.96 526.19 L 458.62 521.37 L 436.90 521.82 L 415.24 527.50 L 373.61 546.75 L 354.89 553.63 L 338.93 557.39 L 324.68 557.18 L 311.28 554.18 L 299.36 546.38 L 289.53 535.43 L 285.49 521.07 L 288.02 505.40 L 296.27 490.63 L 309.55 478.98 L 325.18 470.45 L 342.41 464.46 L 379.49 454.28 L 439.98 435.42 L 461.07 430.16 L 483.11 427.44 L 505.75 428.57 L 528.04 434.62 L 549.64 443.47 L 570.90 453.24 L 591.54 464.27 L 624.25 484.01 L 634.38 492.47 L 640.90 503.88 L 640.91 518.80 L 634.34 534.24 L 624.59 547.53 L 617.04 562.63 L 616.26 580.34 L 620.02 598.86 L 627.99 616.73 L 632.73 634.83 L 632.38 653.04 L 626.28 670.72 L 615.99 687.30 L 600.08 701.09 L 580.92 709.60 L 559.69 712.35 L 492.40 708.43 L 420.77 707.60 Z',
  '{"x1":415,"y1":695,"x2":415,"y2":720}'::jsonb
)
on conflict (id) do nothing;

-- ─── Segments (12: 8 curvas eh_trecho=true + 4 retas false) ──────
-- IDs derivados do layout + ordem (sufixo zero-padded).
-- geometria contém a posição de label + apexReference + cornerType.

insert into public.track_segments (id, layout_id, parcial_id, ordem, eh_trecho, nome, geometria) values
('11111111-b001-1000-2000-000000000000', '11111111-b001-1000-0000-000000000001', 'P1',  0, true,  'CURVA 01',
 '{"x":145,"y":645,"tNaVolta":7.6,"apexReference":{"x":145,"y":645},"apexStrategy":"tardio","cornerType":"lenta","nextStraightLength":280,"_apex_calibration":"DEFAULT"}'::jsonb),
('11111111-b001-1000-2000-000000000001', '11111111-b001-1000-0000-000000000001', 'P1',  1, false, 'RETA PRINCIPAL / BOX',
 '{"x":390,"y":630,"tNaVolta":98.0}'::jsonb),
('11111111-b001-1000-2000-000000000002', '11111111-b001-1000-0000-000000000001', 'P1',  2, true,  'MERGULHO DA BRUXA',
 '{"x":315,"y":305,"tNaVolta":16.5,"apexReference":{"x":315,"y":305},"apexStrategy":"neutro","cornerType":"rapida","nextStraightLength":80,"_apex_calibration":"DEFAULT"}'::jsonb),
('11111111-b001-1000-2000-000000000003', '11111111-b001-1000-0000-000000000001', 'P1',  3, true,  'CURVA 2',
 '{"x":290,"y":85,"tNaVolta":21.1,"apexReference":{"x":290,"y":85},"apexStrategy":"tardio","cornerType":"media","nextStraightLength":220,"_apex_calibration":"DEFAULT"}'::jsonb),
('11111111-b001-1000-2000-000000000004', '11111111-b001-1000-0000-000000000001', 'P2',  4, true,  'CURVA DA JUNÇÃO',
 '{"x":600,"y":330,"tNaVolta":31.0,"apexReference":{"x":600,"y":330},"apexStrategy":"neutro","cornerType":"media","nextStraightLength":180,"_apex_calibration":"DEFAULT"}'::jsonb),
('11111111-b001-1000-2000-000000000005', '11111111-b001-1000-0000-000000000001', 'P2',  5, false, 'PISCINA',
 '{"x":460,"y":275,"tNaVolta":40.0}'::jsonb),
('11111111-b001-1000-2000-000000000006', '11111111-b001-1000-0000-000000000001', 'P3',  6, true,  'CURVA DA BRUXA',
 '{"x":225,"y":570,"tNaVolta":51.8,"apexReference":{"x":225,"y":570},"apexStrategy":"tardio","cornerType":"lenta","nextStraightLength":380,"_apex_calibration":"DEFAULT"}'::jsonb),
('11111111-b001-1000-2000-000000000007', '11111111-b001-1000-0000-000000000001', 'P3',  7, false, 'RETA DO MILITAR',
 '{"x":155,"y":335,"tNaVolta":56.0}'::jsonb),
('11111111-b001-1000-2000-000000000008', '11111111-b001-1000-0000-000000000001', 'P4',  8, true,  'CURVA DO PLACAR',
 '{"x":335,"y":475,"tNaVolta":78.6,"apexReference":{"x":335,"y":475},"apexStrategy":"neutro","cornerType":"media","nextStraightLength":120,"_apex_calibration":"DEFAULT"}'::jsonb),
('11111111-b001-1000-2000-000000000009', '11111111-b001-1000-0000-000000000001', 'P4',  9, true,  'CURVA "S"',
 '{"x":630,"y":525,"tNaVolta":89.2,"apexReference":{"x":630,"y":525},"apexStrategy":"duplo","cornerType":"rapida","nextStraightLength":60,"_apex_calibration":"DEFAULT"}'::jsonb),
('11111111-b001-1000-2000-00000000000a', '11111111-b001-1000-0000-000000000001', 'P4', 10, true,  'CURVA DA VITÓRIA',
 '{"x":645,"y":650,"tNaVolta":93.5,"apexReference":{"x":645,"y":650},"apexStrategy":"tardio","cornerType":"media","nextStraightLength":320,"_apex_calibration":"DEFAULT"}'::jsonb),
('11111111-b001-1000-2000-00000000000b', '11111111-b001-1000-0000-000000000001', 'P4', 11, false, 'RETA OPOSTA',
 '{"x":405,"y":555,"tNaVolta":75.0}'::jsonb)
on conflict (id) do nothing;

-- ─── Marcos canônicos (ghost-map) ───────────────────────
-- Largada/chegada (mesma posição), pit-in/pit-out aproximados pela box.
insert into public.marcos (id, layout_id, tipo, posicao, label) values
('11111111-b001-1000-3000-000000000001', '11111111-b001-1000-0000-000000000001', 'largada', '{"x":415,"y":707}'::jsonb, 'Largada/Chegada'),
('11111111-b001-1000-3000-000000000002', '11111111-b001-1000-0000-000000000001', 'chegada', '{"x":415,"y":707}'::jsonb, 'Largada/Chegada'),
('11111111-b001-1000-3000-000000000003', '11111111-b001-1000-0000-000000000001', 'pit-in',  '{"x":350,"y":707}'::jsonb, 'Pit-in'),
('11111111-b001-1000-3000-000000000004', '11111111-b001-1000-0000-000000000001', 'pit-out', '{"x":480,"y":707}'::jsonb, 'Pit-out')
on conflict (id) do nothing;

-- ─── Reta especial: RETA PRINCIPAL como global de Brasília ──────
-- tempo_medio_ms da volta de referência (Flavio v5, 171.038s total;
-- estimativa 12s na reta principal, ~7% da volta).
insert into public.retas_especiais (id, time_id, track_id, segment_id, tempo_medio_ms, auto_detectada)
values (
  '11111111-b001-1000-4000-000000000001',
  null,                                          -- global (NÃO de time específico)
  '11111111-b001-0000-0000-000000000001',        -- track Brasília
  '11111111-b001-1000-2000-000000000001',        -- segment "RETA PRINCIPAL / BOX"
  12000,
  false                                          -- curadoria, não auto-detectada
)
on conflict (id) do nothing;
