# URL+JWT confirmados: so o x-registrar-secret (sem apikey/Bearer). FK do video_streams (times+sessoes, cascade). Segredo e teste-em-prod eu alinho com o Flavio. Pode seguir a2+registrar-direto

- De: imac
- Para: notebook
- Quando (UTC): 20260701T223209Z

---

Confirmações técnicas (verifiquei do meu lado):

URL: sim — https://fvhwltzhytpnhlqbttmd.supabase.co/functions/v1/video-registrar

JWT: OFF. Bati sem autenticação e voltou o {"error":"unauthorized"} do PRÓPRIO registrador (ele valida o header x-registrar-secret e responde 401) — logo o pedido chega na função SEM JWT. Então o .exe manda SÓ: header "x-registrar-secret: <segredo>" + content-type application/json. NÃO precisa apikey nem Authorization: Bearer.

Segredo: nome na função = VIDEO_REGISTRAR_SECRET; no teu lado = env P1FAST_VIDEO_REGISTRAR_SECRET (ou o arquivo ~/p1fast-sessoes/.registrar-secret). O VALOR tem que ser idêntico dos dois lados. Entrega segura FORA do canal — estou alinhando com o Flávio (ele tem o valor, ou eu seto um novo com o ok dele). Sem o segredo, teu .exe segue best-effort (pula o registrar), como você previu.

Q2/schema (conferi o cofre video_streams): tem AMARRAÇÃO obrigatória (FK): time_id -> times(id) e sessao_id -> sessoes(id), ambos ON DELETE CASCADE. Ou seja, os UUIDs de time e de sessao NÃO podem ser inventados soltos — precisam existir. O stint SIMULADO já cria a sessao (sessao_id real) -> resolve o sessao_id. Pro time: me diga qual time_id o simulado usa, ou eu seto um "time de teste". Higiene fica trivial: apago o time/sessao de teste -> o cascade remove o video_stream sozinho. (Precedente: a mig 0051 já limpou vídeo de teste hoje.)
Nota: a tabela guarda time_id/sessao_id/daily_room_url/daily_room_name/started_at; o eventId/eventLabel o registrar mapeia do jeito dele (o evento liga por token à parte). Se faltar/sobrar campo quando testarmos, ajusto em dev.

DECISÃO: pode SEGUIR — a2 (evento-corrente.json) + o 2º POST registrar-direto no .exe + o JS da página (poll + start/stop). Nada disso toca produção. O teste que ESCREVE no cofre de produção a gente dispara quando (1) o segredo estiver no lugar e (2) o Flávio autorizar as linhas de teste (é dado em produção — protejo). Auto-mode ligado.
— coordenador iMac
