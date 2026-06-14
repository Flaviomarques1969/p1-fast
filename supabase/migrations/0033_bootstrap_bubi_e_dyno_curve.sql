-- ═══════════════════════════════════════════════════════════════════════════
-- APLICAR-EM-PRODUCAO-2026-05-28.sql
-- Bootstrap do Bubi + curva oficial do dinamômetro pra produção
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Autorização literal do Flávio (2026-05-28):
--   "MIGRAR PARA PRODUÇÃO: curva de dinamômetro do Bubi"
--
-- Por que tem mais coisa além da curva:
--   A tabela `dyno_curve` exige um carro cadastrado (FK).
--   A tabela `carros` exige um time cadastrado (FK).
--   Em produção, NENHUM dos dois existe ainda.
--   Por isso este arquivo cadastra:
--     1. Um time-padrão "P1 Fast — Padrão" (ancora o cadastro inicial).
--     2. O carro Bubi com UUID canônico (mesmo que a memória do projeto fixa).
--     3. Os 79 pontos da curva real do dinamômetro Lenza (18/05/2026).
--
-- Idempotente:
--   - INSERTs em times/carros usam ON CONFLICT (id) DO NOTHING.
--   - INSERTs em dyno_curve usam ON CONFLICT (carro_id, rpm) DO UPDATE.
--   Pode ser rodado N vezes sem efeito colateral.
--
-- Como aplicar:
--   1. Abrir Supabase Studio do projeto P1 Fast (produção).
--   2. SQL Editor → colar este arquivo inteiro → Run.
--   3. Conferir output das contagens no fim.
--
-- Como reverter (se algo der errado):
--   DELETE FROM public.dyno_curve WHERE carro_id = '641a81e7-3192-4e68-8183-b8401f105574';
--   DELETE FROM public.carros    WHERE id = '641a81e7-3192-4e68-8183-b8401f105574';
--   DELETE FROM public.times     WHERE id = '00000000-0000-4000-9000-000000000001';

BEGIN;

-- ─── 1. Time-padrão (bootstrap) ───────────────────────────────────────────
INSERT INTO public.times (id, nome, criado_por)
VALUES (
  '00000000-0000-4000-9000-000000000001',
  'P1 Fast — Padrão',
  NULL
)
ON CONFLICT (id) DO NOTHING;

-- ─── 2. Carro Bubi (UUID canônico, ver memória reference_p1fast_bubi_dyno) ─
INSERT INTO public.carros (id, time_id, apelido, modelo, categoria, cor, fonte_temperatura)
VALUES (
  '641a81e7-3192-4e68-8183-b8401f105574',
  '00000000-0000-4000-9000-000000000001',
  'Bolinha',
  'Celta 1.4 (motor Onix preparado)',
  'Turismo',
  NULL,
  'motor'
)
ON CONFLICT (id) DO NOTHING;

-- ─── 3. Curva do dinamômetro do Bubi (79 pontos, Lenza Powerchips 2026-05-18) ─
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 2500, 2.18, 0.78, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 2550, 112.45, 40.83, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 2600, 143.92, 53.28, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 2650, 156.32, 58.98, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 2700, 159.07, 61.15, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 2750, 159.14, 62.31, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 2800, 159.66, 63.65, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 2850, 160.3, 65.05, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 2900, 160.62, 66.32, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 2950, 160.27, 67.32, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 3000, 159.24, 68.02, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 3050, 158.46, 68.81, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 3100, 158.14, 69.8, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 3150, 158.23, 70.96, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 3200, 158.26, 72.1, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 3250, 158.71, 73.44, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 3300, 159.58, 74.98, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 3350, 160.22, 76.42, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 3400, 160.12, 77.51, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 3450, 159.85, 78.52, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 3500, 158.87, 79.17, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 3550, 157.19, 79.45, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 3600, 156.49, 80.21, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 3650, 155.65, 80.89, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 3700, 155.41, 81.87, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 3750, 154.61, 82.55, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 3800, 153.19, 82.88, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 3850, 152.74, 83.73, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 3900, 153.03, 84.97, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 3950, 153.15, 86.13, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 4000, 153.48, 87.41, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 4050, 153.22, 88.35, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 4100, 153.6, 89.67, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 4150, 154.58, 91.34, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 4200, 155.04, 92.71, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 4250, 155.05, 93.83, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 4300, 155.8, 95.39, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 4350, 157.47, 97.53, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 4400, 158.39, 99.23, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 4450, 158.5, 100.42, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 4500, 158.2, 101.36, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 4550, 158.11, 102.43, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 4600, 158.53, 103.83, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 4650, 158.69, 105.06, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 4700, 158.55, 106.1, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 4750, 157.96, 106.83, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 4800, 157.34, 107.53, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 4850, 157.78, 108.96, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 4900, 158.53, 110.6, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 4950, 158.65, 111.81, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 5000, 159.28, 113.39, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 5050, 160.38, 115.31, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 5100, 161.43, 117.22, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 5150, 161.94, 118.74, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 5200, 162.06, 119.98, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 5250, 162.05, 121.13, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 5300, 161.43, 121.82, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 5350, 160.21, 122.04, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 5400, 158.42, 121.8, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 5450, 157.04, 121.86, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 5500, 155.74, 121.96, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 5550, 154.66, 122.21, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 5600, 154.06, 122.83, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 5650, 153.27, 123.3, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 5700, 151.63, 123.06, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 5750, 149.7, 122.56, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 5800, 147.9, 122.14, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 5850, 147.51, 122.86, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 5900, 147.51, 123.92, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 5950, 146.41, 124.03, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 6000, 145.58, 124.36, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 6050, 144.5, 124.47, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 6100, 142.1, 123.42, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 6150, 138.55, 121.32, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 6200, 136.29, 120.31, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 6250, 135.2, 120.31, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 6300, 130.11, 116.71, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 6350, 114.38, 103.41, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;
INSERT INTO public.dyno_curve (carro_id, rpm, torque_nm, potencia_cv, fonte, data_medicao) VALUES ('641A81E7-3192-4E68-8183-B8401F105574', 6400, 78.74, 71.75, 'Dynojet Lenza Powerchips', '2026-05-18') ON CONFLICT (carro_id, rpm) DO UPDATE SET torque_nm = EXCLUDED.torque_nm, potencia_cv = EXCLUDED.potencia_cv;

COMMIT;

-- ─── 4. Verificação automática (Supabase Studio mostra as 3 linhas) ───────
SELECT 'times'      AS tabela, COUNT(*) AS total FROM public.times      WHERE id = '00000000-0000-4000-9000-000000000001'
UNION ALL
SELECT 'carros'     AS tabela, COUNT(*) AS total FROM public.carros     WHERE id = '641a81e7-3192-4e68-8183-b8401f105574'
UNION ALL
SELECT 'dyno_curve' AS tabela, COUNT(*) AS total FROM public.dyno_curve WHERE carro_id = '641a81e7-3192-4e68-8183-b8401f105574';
-- Esperado: times=1, carros=1, dyno_curve=79.
