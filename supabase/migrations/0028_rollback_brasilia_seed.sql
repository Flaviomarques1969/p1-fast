-- 0028_rollback_brasilia_seed.sql — REVERTE 0027 (dados em GPS errado).
DELETE FROM public.track_segments WHERE layout_id = '0dc85cfb-6236-567e-814c-eddf610b301f';
DELETE FROM public.track_layouts WHERE id = '0dc85cfb-6236-567e-814c-eddf610b301f';
