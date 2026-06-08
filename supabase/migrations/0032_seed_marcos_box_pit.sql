-- 0032_seed_marcos_box_pit_brasilia.sql
-- Box, pit-in e pit-out aprovados pelo Flávio em 2026-05-27 (editor visual).

INSERT INTO public.marcos (id, layout_id, tipo, posicao, label) VALUES
('3d8847b7-7161-517b-9de1-2eec96acd395', '0dc85cfb-6236-567e-814c-eddf610b301f', 'box', '{"ponto_gps": {"lat": -15.7731163, "lng": -47.900478}, "origem": "editor-flavio-2026-05-27"}'::jsonb, 'Box do Bubi')
ON CONFLICT (id) DO UPDATE SET posicao=EXCLUDED.posicao, label=EXCLUDED.label;

INSERT INTO public.marcos (id, layout_id, tipo, posicao, label) VALUES
('b8effd39-acf1-55a0-9510-75b69a58f32c', '0dc85cfb-6236-567e-814c-eddf610b301f', 'pit-in', '{"a_gps": {"lat": -15.7750019, "lng": -47.9022626}, "b_gps": {"lat": -15.7750548, "lng": -47.9024985}, "origem": "editor-flavio-2026-05-27"}'::jsonb, 'Entrada do box')
ON CONFLICT (id) DO UPDATE SET posicao=EXCLUDED.posicao, label=EXCLUDED.label;

INSERT INTO public.marcos (id, layout_id, tipo, posicao, label) VALUES
('2b4ee585-e7a3-5b34-9b47-124a63c5da75', '0dc85cfb-6236-567e-814c-eddf610b301f', 'pit-out', '{"a_gps": {"lat": -15.7723991, "lng": -47.8983224}, "b_gps": {"lat": -15.7722173, "lng": -47.8984124}, "origem": "editor-flavio-2026-05-27"}'::jsonb, 'Saída do box')
ON CONFLICT (id) DO UPDATE SET posicao=EXCLUDED.posicao, label=EXCLUDED.label;
