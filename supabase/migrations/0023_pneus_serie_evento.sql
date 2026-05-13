-- 0023_pneus_serie_evento.sql
-- S8 #23 da rodada 1 (2026-05-12). Pneus ganham número de série físico
-- (identificador colado/gravado pelo piloto). Nova tabela evento_pneus
-- liga quais pneus foram pra cada evento, com slots preparados pra TPMS.
--
-- Espelha v22_pneus_serie_evento local.

ALTER TABLE pneus ADD COLUMN numero_serie TEXT;

COMMENT ON COLUMN pneus.numero_serie IS
  'Identificador físico do pneu (ex: "Pneu 01"). Digitado pelo piloto, único por carro (recomendado). Usado pelo TPMS futuro pra rastrear leituras por pneu individual. S8 #23 rodada 1, 2026-05-12.';

CREATE TABLE evento_pneus (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_id               UUID NOT NULL REFERENCES times(id) ON DELETE CASCADE,
  evento_id             UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  pneu_id               UUID NOT NULL REFERENCES pneus(id) ON DELETE CASCADE,
  pressao_atual_psi     NUMERIC,
  temperatura_atual_c   NUMERIC,
  ultima_leitura_em     TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at             TIMESTAMPTZ,
  UNIQUE(evento_id, pneu_id)
);

CREATE INDEX idx_evento_pneus_evento ON evento_pneus(evento_id);
CREATE INDEX idx_evento_pneus_pneu   ON evento_pneus(pneu_id);

ALTER TABLE evento_pneus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evento_pneus: SELECT pelos membros do time"
  ON evento_pneus FOR SELECT
  TO authenticated
  USING (public.is_member(time_id));

CREATE POLICY "evento_pneus: INSERT pelos membros do time"
  ON evento_pneus FOR INSERT
  TO authenticated
  WITH CHECK (public.is_member(time_id));

CREATE POLICY "evento_pneus: UPDATE pelos membros do time"
  ON evento_pneus FOR UPDATE
  TO authenticated
  USING (public.is_member(time_id));

CREATE POLICY "evento_pneus: DELETE pelos membros do time"
  ON evento_pneus FOR DELETE
  TO authenticated
  USING (public.is_member(time_id));

CREATE TRIGGER trg_evento_pneus_upd BEFORE UPDATE ON evento_pneus
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE evento_pneus IS
  'Liga pneus aos eventos. Estrutura preparatória pra TPMS — campos pressão/temperatura atual já presentes, mas hardware ainda não integrado. S8 #23 rodada 1, 2026-05-12.';
