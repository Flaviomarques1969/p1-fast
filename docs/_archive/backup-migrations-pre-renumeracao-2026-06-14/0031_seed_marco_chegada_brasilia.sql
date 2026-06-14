-- 0031_seed_marcos_brasilia.sql
-- Marco de CHEGADA da pista de Brasília (substitui heurística "último trecho").
-- Origem: linha_chegada do MAPA-BRASILIA-DEFINITIVO.json convertida pra GPS.
INSERT INTO public.marcos (id, layout_id, tipo, posicao, label)
VALUES (
  '0e6649de-e8ab-5f13-8805-73b760ad9ae1', '0dc85cfb-6236-567e-814c-eddf610b301f', 'chegada',
  '{"a_gps": {"lat": -15.7728816, "lng": -47.9000707}, "b_gps": {"lat": -15.7725493, "lng": -47.9001926}, "origem": "svg-MAPA-BRASILIA-DEFINITIVO + conversão simples 2026-05-28", "barra_largura_m": 30}'::jsonb,
  'Linha de chegada — Brasília'
) ON CONFLICT (id) DO UPDATE SET posicao=EXCLUDED.posicao, label=EXCLUDED.label;
