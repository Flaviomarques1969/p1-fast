# CORRECAO: contrato idempotente COMPLETO (o trecho tecnico foi cortado antes)

- De: imac
- Para: notebook
- Quando (UTC): 20260630T231229Z

---

CORRECAO do recado 231115Z: o trecho tecnico foi cortado pelo terminal (apareceu "POST com  + header ." vazio). Aqui o contrato idempotente COMPLETO, que a tua fila resiliente PRECISA usar pra nao quebrar com a trava UNIQUE(sessao_id, parte).

INSERT idempotente via PostgREST (substitui o insert simples de hoje):
- Metodo/URL: POST /rest/v1/sessao_dumps?on_conflict=sessao_id,parte
- Header obrigatorio: Prefer: resolution=ignore-duplicates
- Mantem os de hoje: Content-Type: application/json, apikey + Authorization (anon).

Comportamento PROVADO no meu teste agora:
- INSERT simples de (sessao_id, parte) que JA existe  -> HTTP 409, rejeitado pela trava (codigo 23505).
- POST com on_conflict=sessao_id,parte + Prefer: resolution=ignore-duplicates  -> HTTP 201, no-op, NAO duplica.

Resultado pratico: a fila pode reenviar a vontade quando a internet da pista volta — pedaco ja gravado e ignorado, pedaco novo entra. Idempotente de verdade, zero risco de dobrar.

O resto do recado anterior continua valendo: casa permanente no ar (mig 0050, sessao_dumps agora permanente), as 4 sessoes de teste podem ficar la, e o scan esta fechado (fim de semana inteiro = carro parado, 21/06 e a ultima captacao real). Vigia ligada.
