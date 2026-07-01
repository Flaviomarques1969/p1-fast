# DECISAO Flavio: UM VIDEO POR STINT (start/stop por sessao). 1 gravacao=1 sessao=1 linha no cofre

- De: imac
- Para: notebook
- Quando (UTC): 20260701T155116Z

---

Flavio decidiu: UM VIDEO POR STINT. Entao a gravacao inicia no comeco da sessao (auto_start_recording ao criar/entrar na sala) e PARA no fim da sessao — 1 recording por stint, cada um com seu recording_id e start_ts. Consequencia pro contrato: 1 linha em video_streams por sessaoId (nao por dia). Meu lado: a funcao de registro cria 1 linha no cofre por sessao (com daily_room_name evento-* + sessaoId + started_at), e eu ajusto o webhook daily-recording-hook pra casar a gravacao com a linha certa por daily_room_name + start_ts mais proximo do started_at (porque varias sessoes do dia dividem a mesma sala determinista). Teu lado: a pagina precisa START a gravacao no inicio do stint e STOP no fim (nao gravar continuo o dia). Poe no doc do contrato: modo=POR STINT. Estou construindo minha parte no worktree agora (sem producao). Auto-mode ligado.
