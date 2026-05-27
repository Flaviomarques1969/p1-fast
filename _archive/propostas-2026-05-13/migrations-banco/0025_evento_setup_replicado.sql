-- 0025_evento_setup_replicado.sql
-- S7 #17 da rodada 1 (2026-05-12). Replicação de configuração de uma
-- volta passada pra um evento futuro. Quando o piloto toca em
-- "Replicar essa configuração" numa volta passada, criamos uma row
-- aqui apontando pro evento de destino. O detalhe do evento futuro lê
-- e mostra "Setup replicado de [evento origem]".
--
-- overrides_json carrega o JSON da configuracoes.overrides da sessão
-- de origem — preserva snapshot mesmo se o setup do carro mudar depois.
--
-- Decisão de produto (Flávio P3 #17): replica TODOS os campos do setup,
-- seção agrupada, editável; conflito (mais de uma replicação no mesmo
-- evento destino) → último vence, com banner explicativo na UI.
--
-- Espelha v24_evento_setup_replicado local.

CREATE TABLE evento_setup_replicado (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_id           UUID NOT NULL REFERENCES times(id) ON DELETE CASCADE,
  evento_id         UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  origem_volta_id   UUID NOT NULL,
  origem_evento_id  UUID,
  carro_id          UUID REFERENCES carros(id) ON DELETE SET NULL,
  overrides_json    TEXT,
  nota              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at         TIMESTAMPTZ
);

CREATE INDEX idx_evento_setup_replicado_evento
  ON evento_setup_replicado(evento_id);

ALTER TABLE evento_setup_replicado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evento_setup_replicado: SELECT pelos membros do time"
  ON evento_setup_replicado FOR SELECT
  TO authenticated
  USING (public.is_member(time_id));

CREATE POLICY "evento_setup_replicado: INSERT pelos membros do time"
  ON evento_setup_replicado FOR INSERT
  TO authenticated
  WITH CHECK (public.is_member(time_id));

CREATE POLICY "evento_setup_replicado: UPDATE pelos membros do time"
  ON evento_setup_replicado FOR UPDATE
  TO authenticated
  USING (public.is_member(time_id));

CREATE POLICY "evento_setup_replicado: DELETE pelos membros do time"
  ON evento_setup_replicado FOR DELETE
  TO authenticated
  USING (public.is_member(time_id));

CREATE TRIGGER trg_evento_setup_replicado_upd
  BEFORE UPDATE ON evento_setup_replicado
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE evento_setup_replicado IS
  'Snapshot do setup de uma volta passada copiado pra um evento futuro. UI mostra como lembrete pro mecânico. S7 #17 rodada 1, 2026-05-12.';
