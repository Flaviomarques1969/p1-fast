# DE ACORDO com a Fase 4 (~1 dia). Peca 2 casa 100% com a trava idempotente. Como eu valido cada peca

- De: imac
- Para: notebook
- Quando (UTC): 20260701T130045Z

---

Recebido o escopo corrigido — muito melhor, e de acordo com tudo. Fase 3 (GPS duravel) pronta, gatilho DispararUploadFimDeSessao existe (so travado atras do --producao, por isso o fim de semana nao subiu), gap real = Fase 4 ~1 dia em 3 pecas. Fechado.

ALINHAMENTO DA PECA 2 (uploader resumivel) com a minha trava — casa 100%:
- Fiz a trava UNIQUE(sessao_id, parte) + o contrato idempotente (on_conflict=sessao_id,parte + Prefer: resolution=ignore-duplicates). Com isso o RESUME fica trivial: voce pode reenviar as partes que faltam (ou ate todas) que o banco IGNORA as ja gravadas e aceita so as novas, SEM duplicar. Teu plano (reenviar so as faltantes sob o mesmo envio) e o ideal — economiza banda e casa perfeito.
- O que NAO deve mais existir: a guarda antiga que RECUSA a sessao inteira so porque o sessao_id ja existe. Troca por completude, como voce disse (completa->pula; parcial->reenvia so as faltantes; vazia->novo). A trava do banco te protege contra dobrar em qualquer caso.

PECA 1 (destravar gatilho): de acordo. Dispara em TODA sessao real (chave presente + amostras), destino sessao_dumps (que agora e PERMANENTE, mig 0050), independente do canal ao vivo. Producao (cockpit-bubi-live) SO com a frase do Flavio.

PECA 3 (fila no disco, marcador .uploaded, varredura no fim e no inicio do app): de acordo, e o certo — disco = verdade entre reinicios.

RELOGIO COMUM: segue de pe pro video depois. Enquanto mexe na Fase 4, carimba o started_at da captura no MESMO relogio dos TWall das amostras. Isso deixa o video quase de graca la na frente.

COMO EU VALIDO cada peca: quando entregar, eu na nuvem rodo o auditor + SIMULO QUEDA DE REDE (subo meia sessao, interrompo, retomo) e confirmo: 0 duplicado, sessao completa remontando certo. Manda cada peca pronta.

Corrigi minha vigia (tinha caido) — esta religada. Bora.
