-- 0027_seed_brasilia_track_segments.sql
-- Seed das 8 curvas de Brasília com barras de entrada/saída/ápice em GPS.
-- Marcação visual do Flávio em 2026-05-24, calibrada via stint EDA3DA6B.
-- Barras perpendiculares ao trajeto, 12m de largura.

-- Layout principal de Brasília.
INSERT INTO public.track_layouts (id, track_id, nome)
VALUES ('0dc85cfb-6236-567e-814c-eddf610b301f', 'e8335412-3312-54fe-b634-db2d02c7fa81', 'Principal')
ON CONFLICT (id) DO NOTHING;

-- Trecho 0: CURVA 01
INSERT INTO public.track_segments (id, layout_id, ordem, nome, eh_trecho, geometria)
VALUES (
  'e966109d-25fd-57be-8ad0-b806aad184cf',
  '0dc85cfb-6236-567e-814c-eddf610b301f',
  0,
  'CURVA 01',
  true,
  '{"entrada_line_gps": {"a": {"lat": -15.7795606, "lng": -47.9035266}, "b": {"lat": -15.7796196, "lng": -47.9036204}}, "saida_line_gps": {"a": {"lat": -15.7780852, "lng": -47.9046649}, "b": {"lat": -15.778011, "lng": -47.9047464}}, "apice_gps": {"lat": -15.7796221, "lng": -47.9031519}, "centroide_svg": {"x": 602.4, "y": 186.07}, "parcial": "P1", "origem": "editor-pontos-trechos-2026-05-24 + georef 2026-05-28", "barra_largura_m": 12}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET geometria = EXCLUDED.geometria, nome = EXCLUDED.nome, ordem = EXCLUDED.ordem;

-- Trecho 1: CURVA DA RETA OPOSTA
INSERT INTO public.track_segments (id, layout_id, ordem, nome, eh_trecho, geometria)
VALUES (
  '33d97f51-706b-502a-8121-a91feb98f96e',
  '0dc85cfb-6236-567e-814c-eddf610b301f',
  1,
  'CURVA DA RETA OPOSTA',
  true,
  '{"entrada_line_gps": {"a": {"lat": -15.7787917, "lng": -47.8994346}, "b": {"lat": -15.7788977, "lng": -47.899456}}, "saida_line_gps": {"a": {"lat": -15.7775731, "lng": -47.8985193}, "b": {"lat": -15.7774781, "lng": -47.8985726}}, "apice_gps": {"lat": -15.7797119, "lng": -47.8973473}, "centroide_svg": {"x": 262.32, "y": 309.92}, "parcial": "P1", "origem": "editor-pontos-trechos-2026-05-24 + georef 2026-05-28", "barra_largura_m": 12}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET geometria = EXCLUDED.geometria, nome = EXCLUDED.nome, ordem = EXCLUDED.ordem;

-- Trecho 2: CURVA 2
INSERT INTO public.track_segments (id, layout_id, ordem, nome, eh_trecho, geometria)
VALUES (
  '062aea3b-9640-57ca-8576-41841d8f8311',
  '0dc85cfb-6236-567e-814c-eddf610b301f',
  2,
  'CURVA 2',
  true,
  '{"entrada_line_gps": {"a": {"lat": -15.7707399, "lng": -47.9028178}, "b": {"lat": -15.7706705, "lng": -47.9029037}}, "saida_line_gps": {"a": {"lat": -15.7705734, "lng": -47.9013059}, "b": {"lat": -15.7704752, "lng": -47.9013524}}, "apice_gps": {"lat": -15.7715191, "lng": -47.9010608}, "centroide_svg": {"x": 640.34, "y": 653.09}, "parcial": "P1", "origem": "editor-pontos-trechos-2026-05-24 + georef 2026-05-28", "barra_largura_m": 12}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET geometria = EXCLUDED.geometria, nome = EXCLUDED.nome, ordem = EXCLUDED.ordem;

-- Trecho 3: CURVA DA JUNÇÃO
INSERT INTO public.track_segments (id, layout_id, ordem, nome, eh_trecho, geometria)
VALUES (
  '0e2e66f1-525f-5dfe-84c8-22ffcbe89249',
  '0dc85cfb-6236-567e-814c-eddf610b301f',
  3,
  'CURVA DA JUNÇÃO',
  true,
  '{"entrada_line_gps": {"a": {"lat": -15.7732471, "lng": -47.8969901}, "b": {"lat": -15.7731803, "lng": -47.8969021}}, "saida_line_gps": {"a": {"lat": -15.7746439, "lng": -47.897888}, "b": {"lat": -15.7745386, "lng": -47.897863}}, "apice_gps": {"lat": -15.7754138, "lng": -47.8954244}, "centroide_svg": {"x": 235.02, "y": 575.66}, "parcial": "P2", "origem": "editor-pontos-trechos-2026-05-24 + georef 2026-05-28", "barra_largura_m": 12}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET geometria = EXCLUDED.geometria, nome = EXCLUDED.nome, ordem = EXCLUDED.ordem;

-- Trecho 4: CURVA DA BRUXA
INSERT INTO public.track_segments (id, layout_id, ordem, nome, eh_trecho, geometria)
VALUES (
  '3c548950-a2f8-56bf-90b9-948415f56b00',
  '0dc85cfb-6236-567e-814c-eddf610b301f',
  4,
  'CURVA DA BRUXA',
  true,
  '{"entrada_line_gps": {"a": {"lat": -15.7762786, "lng": -47.9036181}, "b": {"lat": -15.7763543, "lng": -47.9036981}}, "saida_line_gps": {"a": {"lat": -15.7778523, "lng": -47.902903}, "b": {"lat": -15.7777781, "lng": -47.9029844}}, "apice_gps": {"lat": -15.778212, "lng": -47.9021293}, "centroide_svg": {"x": 570.61, "y": 281.93}, "parcial": "P3", "origem": "editor-pontos-trechos-2026-05-24 + georef 2026-05-28", "barra_largura_m": 12}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET geometria = EXCLUDED.geometria, nome = EXCLUDED.nome, ordem = EXCLUDED.ordem;

-- Trecho 5: CURVA DO PLACAR
INSERT INTO public.track_segments (id, layout_id, ordem, nome, eh_trecho, geometria)
VALUES (
  '7ae768fd-17ec-5753-9743-5eed6e58da40',
  '0dc85cfb-6236-567e-814c-eddf610b301f',
  5,
  'CURVA DO PLACAR',
  true,
  '{"entrada_line_gps": {"a": {"lat": -15.7769304, "lng": -47.9016104}, "b": {"lat": -15.7770326, "lng": -47.9016469}}, "saida_line_gps": {"a": {"lat": -15.7755809, "lng": -47.9019666}, "b": {"lat": -15.7756141, "lng": -47.9020732}}, "apice_gps": {"lat": -15.7773642, "lng": -47.9013671}, "centroide_svg": {"x": 542.91, "y": 342.82}, "parcial": "P4", "origem": "editor-pontos-trechos-2026-05-24 + georef 2026-05-28", "barra_largura_m": 12}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET geometria = EXCLUDED.geometria, nome = EXCLUDED.nome, ordem = EXCLUDED.ordem;

-- Trecho 6: CURVA "S"
INSERT INTO public.track_segments (id, layout_id, ordem, nome, eh_trecho, geometria)
VALUES (
  '3eaa50b3-a545-57fc-b9ab-dfec113f08aa',
  '0dc85cfb-6236-567e-814c-eddf610b301f',
  6,
  'CURVA "S"',
  true,
  '{"entrada_line_gps": {"a": {"lat": -15.7757668, "lng": -47.8974733}, "b": {"lat": -15.775819, "lng": -47.8973752}}, "saida_line_gps": {"a": {"lat": -15.7779956, "lng": -47.8972844}, "b": {"lat": -15.7781001, "lng": -47.8973128}}, "apice_gps": {"lat": -15.7772447, "lng": -47.8960819}, "centroide_svg": {"x": 237.23, "y": 466.04}, "parcial": "P4", "origem": "editor-pontos-trechos-2026-05-24 + georef 2026-05-28", "barra_largura_m": 12}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET geometria = EXCLUDED.geometria, nome = EXCLUDED.nome, ordem = EXCLUDED.ordem;

-- Trecho 7: CURVA DA VITÓRIA
INSERT INTO public.track_segments (id, layout_id, ordem, nome, eh_trecho, geometria)
VALUES (
  'b319dd1a-161c-5777-8b80-1a9fdd1a88da',
  '0dc85cfb-6236-567e-814c-eddf610b301f',
  7,
  'CURVA DA VITÓRIA',
  true,
  '{"entrada_line_gps": {"a": {"lat": -15.7781153, "lng": -47.8972116}, "b": {"lat": -15.7782197, "lng": -47.89724}}, "saida_line_gps": {"a": {"lat": -15.7796589, "lng": -47.898972}, "b": {"lat": -15.7797645, "lng": -47.8989955}}, "apice_gps": {"lat": -15.7798799, "lng": -47.8963545}, "centroide_svg": {"x": 201.14, "y": 323.18}, "parcial": "P4", "origem": "editor-pontos-trechos-2026-05-24 + georef 2026-05-28", "barra_largura_m": 12}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET geometria = EXCLUDED.geometria, nome = EXCLUDED.nome, ordem = EXCLUDED.ordem;
