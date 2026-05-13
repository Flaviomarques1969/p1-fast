-- 0024_acoes_a_fazer.sql
-- S8 #22 da rodada 1 (2026-05-12). Lista pessoal LIVRE de ações a
-- fazer (separada das pendências canônicas curadas). Per-evento
-- conforme decisão Flávio P3 #22 — cada evento tem suas próprias
-- ações. Some na próxima abertura ao marcar feita (UI filtra
-- feita_em IS NULL).
--
-- Espelha v23_acoes_a_fazer local.

CREATE TABLE acoes_a_fazer (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_id     UUID NOT NULL REFERENCES times(id) ON DELETE CASCADE,
  evento_id   UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  piloto_id   UUID,  -- opcional; quem criou a ação (pré-F1 = nullable)
  descricao   TEXT NOT NULL CHECK (length(trim(descricao)) > 0),
  feita_em    TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at   TIMESTAMPTZ
);

CREATE INDEX idx_acoes_a_fazer_evento ON acoes_a_fazer(evento_id);

ALTER TABLE acoes_a_fazer ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acoes_a_fazer: SELECT pelos membros do time"
  ON acoes_a_fazer FOR SELECT
  TO authenticated
  USING (public.is_member(time_id));

CREATE POLICY "acoes_a_fazer: INSERT pelos membros do time"
  ON acoes_a_fazer FOR INSERT
  TO authenticated
  WITH CHECK (public.is_member(time_id));

CREATE POLICY "acoes_a_fazer: UPDATE pelos membros do time"
  ON acoes_a_fazer FOR UPDATE
  TO authenticated
  USING (public.is_member(time_id));

CREATE POLICY "acoes_a_fazer: DELETE pelos membros do time"
  ON acoes_a_fazer FOR DELETE
  TO authenticated
  USING (public.is_member(time_id));

CREATE TRIGGER trg_acoes_a_fazer_upd BEFORE UPDATE ON acoes_a_fazer
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE acoes_a_fazer IS
  'Lista pessoal livre de ações a fazer no evento (separada de pendencias_template). Quando o piloto marca como feita, feita_em é preenchido e UI esconde. S8 #22 rodada 1, 2026-05-12.';
