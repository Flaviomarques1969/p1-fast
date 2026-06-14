-- 0030_seed_brasilia_segments_aprovado_flavio.sql
-- BARRAS APROVADAS PELO FLÁVIO em 2026-05-27 (editor visual).
-- IMPORTANTE: o ápice NÃO é cadastrado aqui — ele é calculado
-- dinamicamente a partir da melhor passagem na configuração ativa
-- (carro + tipo de pneu). Hoje: motor 1.4 + pneu radial 185 aro 14.
-- Origem: _design-reference/BARRAS-BRASILIA-FLAVIO-APROVADO-2026-05-27.json

UPDATE public.track_segments
   SET geometria = '{"entrada_line_gps": {"a": {"lat": -15.7721115, "lng": -47.8981304}, "b": {"lat": -15.7719055, "lng": -47.8982869}}, "saida_line_gps": {"a": {"lat": -15.7727385, "lng": -47.8965379}, "b": {"lat": -15.7726759, "lng": -47.8961678}}, "apice_modo": "calculado-da-melhor-passagem", "apice_regra": "lugar mais dentro da curva na melhor passagem da configuração carro+pneu", "origem": "editor-visual-flavio-2026-05-27", "aprovado_em": "2026-05-27T22:52:23.709Z", "barra_largura_m": null}'::jsonb, nome = 'CURVA 01', ordem = 0
 WHERE id = 'ce78dc3a-ceb4-53b7-8481-d38b62cf1f22';

UPDATE public.track_segments
   SET geometria = '{"entrada_line_gps": {"a": {"lat": -15.7736357, "lng": -47.9012942}, "b": {"lat": -15.7738691, "lng": -47.9013007}}, "saida_line_gps": {"a": {"lat": -15.77505, "lng": -47.9018049}, "b": {"lat": -15.7748252, "lng": -47.9015794}}, "apice_modo": "calculado-da-melhor-passagem", "apice_regra": "lugar mais dentro da curva na melhor passagem da configuração carro+pneu", "origem": "editor-visual-flavio-2026-05-27", "aprovado_em": "2026-05-27T22:52:23.709Z", "barra_largura_m": null}'::jsonb, nome = 'CURVA DA RETA OPOSTA', ordem = 2
 WHERE id = 'bb99ec7c-cc04-5f0d-9c38-494d72558815';

UPDATE public.track_segments
   SET geometria = '{"entrada_line_gps": {"a": {"lat": -15.7788292, "lng": -47.8958051}, "b": {"lat": -15.7788084, "lng": -47.8954879}}, "saida_line_gps": {"a": {"lat": -15.7796307, "lng": -47.8967418}, "b": {"lat": -15.7800343, "lng": -47.8969349}}, "apice_modo": "calculado-da-melhor-passagem", "apice_regra": "lugar mais dentro da curva na melhor passagem da configuração carro+pneu", "origem": "editor-visual-flavio-2026-05-27", "aprovado_em": "2026-05-27T22:52:23.709Z", "barra_largura_m": null}'::jsonb, nome = 'CURVA 2', ordem = 3
 WHERE id = 'c175d6f2-366d-52fc-aa72-f3254202b9b2';

UPDATE public.track_segments
   SET geometria = '{"entrada_line_gps": {"a": {"lat": -15.7788678, "lng": -47.9012248}, "b": {"lat": -15.7791192, "lng": -47.9012172}}, "saida_line_gps": {"a": {"lat": -15.777667, "lng": -47.9011385}, "b": {"lat": -15.7774058, "lng": -47.9011026}}, "apice_modo": "calculado-da-melhor-passagem", "apice_regra": "lugar mais dentro da curva na melhor passagem da configuração carro+pneu", "origem": "editor-visual-flavio-2026-05-27", "aprovado_em": "2026-05-27T22:52:23.709Z", "barra_largura_m": null}'::jsonb, nome = 'CURVA DA JUNÇÃO', ordem = 4
 WHERE id = 'cf329fd2-6698-5b6b-a687-a5f551a47ece';

UPDATE public.track_segments
   SET geometria = '{"entrada_line_gps": {"a": {"lat": -15.7742106, "lng": -47.8967117}, "b": {"lat": -15.7742424, "lng": -47.8969517}}, "saida_line_gps": {"a": {"lat": -15.7732317, "lng": -47.8979449}, "b": {"lat": -15.773637, "lng": -47.8978742}}, "apice_modo": "calculado-da-melhor-passagem", "apice_regra": "lugar mais dentro da curva na melhor passagem da configuração carro+pneu", "origem": "editor-visual-flavio-2026-05-27", "aprovado_em": "2026-05-27T22:52:23.709Z", "barra_largura_m": null}'::jsonb, nome = 'CURVA DA BRUXA', ordem = 6
 WHERE id = '3a4a6027-55d7-50b8-b338-72c4e556afdd';

UPDATE public.track_segments
   SET geometria = '{"entrada_line_gps": {"a": {"lat": -15.7745902, "lng": -47.8985342}, "b": {"lat": -15.7744208, "lng": -47.898723}}, "saida_line_gps": {"a": {"lat": -15.775169, "lng": -47.897642}, "b": {"lat": -15.7753822, "lng": -47.8973866}}, "apice_modo": "calculado-da-melhor-passagem", "apice_regra": "lugar mais dentro da curva na melhor passagem da configuração carro+pneu", "origem": "editor-visual-flavio-2026-05-27", "aprovado_em": "2026-05-27T22:52:23.709Z", "barra_largura_m": null}'::jsonb, nome = 'CURVA DO PLACAR', ordem = 8
 WHERE id = '5dfc81d1-041c-5047-b84d-0be051b14dcd';

UPDATE public.track_segments
   SET geometria = '{"entrada_line_gps": {"a": {"lat": -15.776674, "lng": -47.9014559}, "b": {"lat": -15.7769575, "lng": -47.9015447}}, "saida_line_gps": {"a": {"lat": -15.7750309, "lng": -47.9025097}, "b": {"lat": -15.7752271, "lng": -47.9027001}}, "apice_modo": "calculado-da-melhor-passagem", "apice_regra": "lugar mais dentro da curva na melhor passagem da configuração carro+pneu", "origem": "editor-visual-flavio-2026-05-27", "aprovado_em": "2026-05-27T22:52:23.709Z", "barra_largura_m": null}'::jsonb, nome = 'CURVA "S"', ordem = 9
 WHERE id = '96baf23c-1b45-5bd6-8d07-a4d3c1670161';

UPDATE public.track_segments
   SET geometria = '{"entrada_line_gps": {"a": {"lat": -15.7748812, "lng": -47.9026011}, "b": {"lat": -15.7751267, "lng": -47.9029175}}, "saida_line_gps": {"a": {"lat": -15.7735485, "lng": -47.9022087}, "b": {"lat": -15.7732967, "lng": -47.9023204}}, "apice_modo": "calculado-da-melhor-passagem", "apice_regra": "lugar mais dentro da curva na melhor passagem da configuração carro+pneu", "origem": "editor-visual-flavio-2026-05-27", "aprovado_em": "2026-05-27T22:52:23.709Z", "barra_largura_m": null}'::jsonb, nome = 'CURVA DA VITÓRIA', ordem = 10
 WHERE id = '6c64bc49-bea4-5013-8de8-b858189ee425';
