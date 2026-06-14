-- ═══════════════════════════════════════════════════════════════════════════
-- 0037_gear_ratios_bubi.sql
-- Relações de marcha do Bubi (Celta 1.4 com transmissão F17 Wide Ratio).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Por quê:
--   src/domain/dyno-target-calculator.js (versão antiga) cai num fallback de
--   90% do redline quando o carro não tem gear_ratios cadastrados. O carro
--   Bubi foi cadastrado em 0033 com a curva do dinamômetro mas SEM as
--   relações de marcha — então o shift light v1 opera em modo seguro
--   silencioso.
--   O orquestrador v2 (shift-light-orquestrador.js) também precisa das
--   relações pra calcular o cruzamento de força por marcha. Sem isso, ele
--   trabalha só pela janela do modo.
--
-- Origem dos números:
--   Transmissão F17 Wide Ratio (Celta 1.4 / Onix) — manual oficial GM.
--   Diferencial 3.94 — memória reference_p1fast_bubi_dyno e comentário
--   linha 26 de web/cockpit/shift-light-orquestrador.js.
--
-- Idempotente:
--   ON CONFLICT em (carro_id, marcha) faz UPDATE — pode rodar N vezes.
--
-- Reverter (se errar relação):
--   DELETE FROM public.gear_ratios WHERE carro_id = '641a81e7-3192-4e68-8183-b8401f105574';

BEGIN;

-- ─── Relações de marcha do Bubi ─────────────────────────────────────────────
-- F17 Wide Ratio: 3.91 / 2.16 / 1.40 / 1.04 / 0.87 + diferencial 3.94
-- Convenção tabela gear_ratios (migration 0014/0022):
--   marcha INT NOT NULL, ratio NUMERIC (relação interna da marcha),
--   final_drive NUMERIC (diferencial). Todas as marchas compartilham o mesmo
--   final_drive — coluna repetida pra preservar o modelo de linha por marcha.

INSERT INTO public.gear_ratios (carro_id, marcha, ratio, final_drive) VALUES
  ('641a81e7-3192-4e68-8183-b8401f105574', 1, 3.91, 3.94),
  ('641a81e7-3192-4e68-8183-b8401f105574', 2, 2.16, 3.94),
  ('641a81e7-3192-4e68-8183-b8401f105574', 3, 1.40, 3.94),
  ('641a81e7-3192-4e68-8183-b8401f105574', 4, 1.04, 3.94),
  ('641a81e7-3192-4e68-8183-b8401f105574', 5, 0.87, 3.94)
ON CONFLICT (carro_id, marcha)
DO UPDATE SET ratio = EXCLUDED.ratio, final_drive = EXCLUDED.final_drive;

COMMIT;

-- ─── Verificação ────────────────────────────────────────────────────────────
SELECT marcha, ratio, final_drive
FROM public.gear_ratios
WHERE carro_id = '641a81e7-3192-4e68-8183-b8401f105574'
ORDER BY marcha;
-- Esperado: 5 linhas (1..5), final_drive=3.94 em todas.
