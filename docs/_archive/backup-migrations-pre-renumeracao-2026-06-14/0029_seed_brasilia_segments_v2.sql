-- 0029_seed_brasilia_track_segments_v2.sql
-- Seed v2 — barras derivadas direto do trajeto GPS real (não dependem mais
-- da calibração SVG do editor antigo). 30m antes e depois do ápice,
-- barras perpendiculares de 12m.

INSERT INTO public.track_layouts (id, track_id, nome) VALUES
('0dc85cfb-6236-567e-814c-eddf610b301f', 'e8335412-3312-54fe-b634-db2d02c7fa81', 'Principal') ON CONFLICT (id) DO NOTHING;

-- Ordem 0: CURVA 01
INSERT INTO public.track_segments (id, layout_id, ordem, nome, eh_trecho, geometria) VALUES (
  'ce78dc3a-ceb4-53b7-8481-d38b62cf1f22', '0dc85cfb-6236-567e-814c-eddf610b301f', 0, 'CURVA 01', true, '{"entrada_line_gps": {"a": {"lat": -15.7718974, "lng": -47.8968895}, "b": {"lat": -15.7718022, "lng": -47.8968365}}, "saida_line_gps": {"a": {"lat": -15.7723494, "lng": -47.8964373}, "b": {"lat": -15.7722799, "lng": -47.8963515}}, "apice_gps": {"lat": -15.7720235, "lng": -47.8965953}, "origem": "derivado-do-trajeto-gps-2026-05-28", "distancia_entrada_m": 30, "distancia_saida_m": 30, "barra_largura_m": 12}'::jsonb
) ON CONFLICT (id) DO UPDATE SET geometria=EXCLUDED.geometria, nome=EXCLUDED.nome, ordem=EXCLUDED.ordem;

-- Ordem 2: CURVA DA RETA OPOSTA
INSERT INTO public.track_segments (id, layout_id, ordem, nome, eh_trecho, geometria) VALUES (
  'bb99ec7c-cc04-5f0d-9c38-494d72558815', '0dc85cfb-6236-567e-814c-eddf610b301f', 2, 'CURVA DA RETA OPOSTA', true, '{"entrada_line_gps": {"a": {"lat": -15.7737308, "lng": -47.9016232}, "b": {"lat": -15.7738099, "lng": -47.9015469}}, "saida_line_gps": {"a": {"lat": -15.7744337, "lng": -47.9020574}, "b": {"lat": -15.7744059, "lng": -47.9019492}}, "apice_gps": {"lat": -15.7739802, "lng": -47.9019389}, "origem": "derivado-do-trajeto-gps-2026-05-28", "distancia_entrada_m": 30, "distancia_saida_m": 30, "barra_largura_m": 12}'::jsonb
) ON CONFLICT (id) DO UPDATE SET geometria=EXCLUDED.geometria, nome=EXCLUDED.nome, ordem=EXCLUDED.ordem;

-- Ordem 3: CURVA 2
INSERT INTO public.track_segments (id, layout_id, ordem, nome, eh_trecho, geometria) VALUES (
  'c175d6f2-366d-52fc-aa72-f3254202b9b2', '0dc85cfb-6236-567e-814c-eddf610b301f', 3, 'CURVA 2', true, '{"entrada_line_gps": {"a": {"lat": -15.779359, "lng": -47.8956944}, "b": {"lat": -15.7794201, "lng": -47.895602}}, "saida_line_gps": {"a": {"lat": -15.7797676, "lng": -47.8963753}, "b": {"lat": -15.7798752, "lng": -47.8963661}}, "apice_gps": {"lat": -15.7797165, "lng": -47.8959049}, "origem": "derivado-do-trajeto-gps-2026-05-28", "distancia_entrada_m": 30, "distancia_saida_m": 30, "barra_largura_m": 12}'::jsonb
) ON CONFLICT (id) DO UPDATE SET geometria=EXCLUDED.geometria, nome=EXCLUDED.nome, ordem=EXCLUDED.ordem;

-- Ordem 4: CURVA DA JUNÇÃO
INSERT INTO public.track_segments (id, layout_id, ordem, nome, eh_trecho, geometria) VALUES (
  'cf329fd2-6698-5b6b-a687-a5f551a47ece', '0dc85cfb-6236-567e-814c-eddf610b301f', 4, 'CURVA DA JUNÇÃO', true, '{"entrada_line_gps": {"a": {"lat": -15.7785617, "lng": -47.9021793}, "b": {"lat": -15.7786039, "lng": -47.9022824}}, "saida_line_gps": {"a": {"lat": -15.7780433, "lng": -47.9022014}, "b": {"lat": -15.7779946, "lng": -47.9023014}}, "apice_gps": {"lat": -15.7782949, "lng": -47.9022903}, "origem": "derivado-do-trajeto-gps-2026-05-28", "distancia_entrada_m": 30, "distancia_saida_m": 30, "barra_largura_m": 12}'::jsonb
) ON CONFLICT (id) DO UPDATE SET geometria=EXCLUDED.geometria, nome=EXCLUDED.nome, ordem=EXCLUDED.ordem;

-- Ordem 6: CURVA DA BRUXA
INSERT INTO public.track_segments (id, layout_id, ordem, nome, eh_trecho, geometria) VALUES (
  '3a4a6027-55d7-50b8-b338-72c4e556afdd', '0dc85cfb-6236-567e-814c-eddf610b301f', 6, 'CURVA DA BRUXA', true, '{"entrada_line_gps": {"a": {"lat": -15.7739502, "lng": -47.8967773}, "b": {"lat": -15.7739913, "lng": -47.8968809}}, "saida_line_gps": {"a": {"lat": -15.773389, "lng": -47.897528}, "b": {"lat": -15.7734898, "lng": -47.8975681}}, "apice_gps": {"lat": -15.7736283, "lng": -47.8970424}, "origem": "derivado-do-trajeto-gps-2026-05-28", "distancia_entrada_m": 30, "distancia_saida_m": 30, "barra_largura_m": 12}'::jsonb
) ON CONFLICT (id) DO UPDATE SET geometria=EXCLUDED.geometria, nome=EXCLUDED.nome, ordem=EXCLUDED.ordem;

-- Ordem 8: CURVA DO PLACAR
INSERT INTO public.track_segments (id, layout_id, ordem, nome, eh_trecho, geometria) VALUES (
  '5dfc81d1-041c-5047-b84d-0be051b14dcd', '0dc85cfb-6236-567e-814c-eddf610b301f', 8, 'CURVA DO PLACAR', true, '{"entrada_line_gps": {"a": {"lat": -15.7743272, "lng": -47.8978085}, "b": {"lat": -15.7742238, "lng": -47.8977763}}, "saida_line_gps": {"a": {"lat": -15.7750071, "lng": -47.897522}, "b": {"lat": -15.7750278, "lng": -47.897412}}, "apice_gps": {"lat": -15.7745527, "lng": -47.8974684}, "origem": "derivado-do-trajeto-gps-2026-05-28", "distancia_entrada_m": 30, "distancia_saida_m": 30, "barra_largura_m": 12}'::jsonb
) ON CONFLICT (id) DO UPDATE SET geometria=EXCLUDED.geometria, nome=EXCLUDED.nome, ordem=EXCLUDED.ordem;

-- Ordem 9: CURVA "S"
INSERT INTO public.track_segments (id, layout_id, ordem, nome, eh_trecho, geometria) VALUES (
  '96baf23c-1b45-5bd6-8d07-a4d3c1670161', '0dc85cfb-6236-567e-814c-eddf610b301f', 9, 'CURVA "S"', true, '{"entrada_line_gps": {"a": {"lat": -15.7767131, "lng": -47.901862}, "b": {"lat": -15.7768059, "lng": -47.9019193}}, "saida_line_gps": {"a": {"lat": -15.7760989, "lng": -47.9022644}, "b": {"lat": -15.7761588, "lng": -47.9023576}}, "apice_gps": {"lat": -15.7765917, "lng": -47.9022435}, "origem": "derivado-do-trajeto-gps-2026-05-28", "distancia_entrada_m": 30, "distancia_saida_m": 30, "barra_largura_m": 12}'::jsonb
) ON CONFLICT (id) DO UPDATE SET geometria=EXCLUDED.geometria, nome=EXCLUDED.nome, ordem=EXCLUDED.ordem;

-- Ordem 10: CURVA DA VITÓRIA
INSERT INTO public.track_segments (id, layout_id, ordem, nome, eh_trecho, geometria) VALUES (
  '6c64bc49-bea4-5013-8de8-b858189ee425', '0dc85cfb-6236-567e-814c-eddf610b301f', 10, 'CURVA DA VITÓRIA', true, '{"entrada_line_gps": {"a": {"lat": -15.7745418, "lng": -47.9025176}, "b": {"lat": -15.7745636, "lng": -47.9026273}}, "saida_line_gps": {"a": {"lat": -15.7740177, "lng": -47.9025206}, "b": {"lat": -15.7739752, "lng": -47.9026236}}, "apice_gps": {"lat": -15.7742604, "lng": -47.9026401}, "origem": "derivado-do-trajeto-gps-2026-05-28", "distancia_entrada_m": 30, "distancia_saida_m": 30, "barra_largura_m": 12}'::jsonb
) ON CONFLICT (id) DO UPDATE SET geometria=EXCLUDED.geometria, nome=EXCLUDED.nome, ordem=EXCLUDED.ordem;
