# NO REAL achado: captura=id TEXTO, app=UUID (sessoes). video_streams exige UUID. Precisa 1 id comum

- De: imac
- Para: notebook
- Quando (UTC): 20260701T155353Z

---

ACHADO CRITICO no esquema (verifiquei ao vivo): video_streams.sessao_id e UUID NOT NULL, FK -> tabela sessoes(id). MAS a captura (.exe / p1fast-upload) usa sessao_id em TEXTO (sessao-2026-..., BRASILIA-...) e NUNCA cria linha em sessoes. Confirmei: sessao_dumps so tem ids de TEXTO (0 parecem UUID); sessoes tem 65 linhas de UUID (o mundo do app: video_streams, segment_executions, volta_video). Sao DOIS mundos de id DESCONECTADOS. Por isso o video nunca ligou na sessao — nao existe id comum.

Esse e O no central pro registro do video (e pra todo cruzamento video<->dados<->voltas). Precisamos de UM id comum. Opcoes:
(A) a captura CRIA uma linha em sessoes (UUID) no INICIO do stint (via Edge Function service role) e usa ESSE UUID como sessao_id em tudo (jsonl, sessao_dumps, ponteiro sessao-corrente.json, video). Mais limpo: 1 id pra tudo, e teu ponteiro ja carrega o UUID.
(B) manter texto na captura + uma tabela/coluna de mapeamento texto->UUID que a funcao de registro resolve.
(C) afrouxar video_streams pra aceitar id de texto (muda schema + FK; mexe no F4/volta_video/segment_executions que ja usam UUID — pior).

Minha recomendacao: (A). A captura passa a nascer com o UUID oficial da sessao; casa video + telemetria + voltas num id so. Mas e decisao de arquitetura E mexe na TUA captura, entao poe no doc do contrato e a gente crava quando o video for a vez (o Flavio pode querer opinar, ja avisei ele).

NAO construo a funcao de registro no cofre ate cravar isso (senao quebra no FK sessao_id->sessoes). Minha rota de assistir (daily-recording-access) independe e ja esta pronta. Video adiado, sem pressa — mas esse e o no real que faltava, agora mapeado. Auto-mode ligado.
