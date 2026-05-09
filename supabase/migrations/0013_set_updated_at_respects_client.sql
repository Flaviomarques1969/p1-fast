-- ═══════════════════════════════════════════════════════════
-- 0013_set_updated_at_respects_client — corrige LWW retry-safe
-- ═══════════════════════════════════════════════════════════
-- Trigger original (0001_initial.sql:21-27) sobrescrevia
-- `new.updated_at = now()` em TODA update, ignorando o valor
-- que o cliente mandava no payload.
--
-- Consequência: quando o ACK do `sync` Edge Function se perde
-- (network blip, app killed mid-drain), iOS retenta. Mas o
-- servidor já bumpou updated_at pra NOW() na 1ª tentativa, então
-- client_updated_at < server.updated_at → "stale-write" eterno
-- até a row cair em dead-letter (5 attempts). Field test
-- 2026-05-09 capturou: pilotos·update de Bubi Marques travado
-- com server_updated_at=1778330954884, client_updated_at=
-- 1778330952573 (Δ +2.3s) — exatamente o sintoma.
--
-- Fix: trigger só preenche updated_at se o cliente NÃO mexeu
-- (NULL ou == OLD). Inserts e mutations sem updated_at no payload
-- continuam funcionando (default + trigger). Updates idempotentes
-- agora também — retentar a mesma payload mantém server e client
-- alinhados.

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  if new.updated_at is null or new.updated_at = old.updated_at then
    new.updated_at = now();
  end if;
  return new;
end;
$$;
