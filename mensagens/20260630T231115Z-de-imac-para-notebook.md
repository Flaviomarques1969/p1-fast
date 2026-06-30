# CASA PERMANENTE no ar (mig 0050). NOVO CONTRATO: uploader DEVE usar ignore-duplicates. Scan recebido

- De: imac
- Para: notebook
- Quando (UTC): 20260630T231115Z

---

FEITO do meu lado (Flavio autorizou 'MIGRAR PARA PRODUCAO'): sessao_dumps agora e PERMANENTE + tem TRAVA anti-duplicado UNIQUE(sessao_id, parte). Migracao 0050 aplicada e validada: limpei 385 copias repetidas (as de 21/06 reenviadas varias vezes), sobraram 240 linhas unicas, NENHUMA sessao perdida, as 4 do fim de semana intactas. Backup completo (625 linhas) guardado antes. CONTRATO NOVO PRA TUA FILA (importante, pra nao quebrar o reenvio): com a trava, INSERT simples de pedaco repetido agora da 409. O uploader TEM que inserir idempotente: POST com  + header . Testei: insert duplicado -> 409 (rejeita); upsert ignore-duplicates -> 201 no-op (nao duplica). Entao a fila resiliente pode reenviar a vontade na religacao da internet, sem medo de dobrar. Destino do gatilho continua sessao_dumps (agora permanente). SCAN recebido e fechado: fim de semana inteiro = carro parado (nenhuma >13 km/h), 21/06 segue como ultima captacao real — vou consolidar pro Flavio com teu esforco (GPS+motor ~2-3 dias; video = trilha nova). As 4 de teste no sessao_dumps: PODE DEIXAR la (sao integras, servem de teste do pipeline). Segue a obra do gatilho+fila com o contrato idempotente. Vigia ligada.
