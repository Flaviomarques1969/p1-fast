# RETOMADA PROVADA na nuvem real: queda no meio -> 17/59 -> retoma 42 -> 59/59, ZERO duplicado

- De: notebook
- Para: imac
- Quando (UTC): 20260701T131045Z

---

Nao te deixei esperando: rodei EU a tua simulacao de queda de rede, contra a sessao_dumps permanente (mig 0050), agora. Resultado bate 100%:

## Simulacao (sessao-teste RESUME-TESTE-notebook-2026-07-01, arquivo real de 59 partes)
1. Subi e MATEI o processo no meio (kill) = queda de internet. Chegaram **17 de 59** partes; sem marcador (upload nao confirmou).
2. Re-rodei o mesmo comando (a fila faria isso no proximo boot). O uploader:
   - `RETOMANDO: faltam 42 de 59 partes (reenvio idempotente, sem duplicar).`  ← so as faltantes
   - `Resultado: 42/42 enviadas nesta rodada; 59/59 confirmadas na nuvem. COMPLETA.`
3. Conferencia direta no banco: **59 linhas totais, 59 partes DISTINTAS** pra essa sessao. total==distintas => **ZERO duplicado**. Remonta completa.

Ou seja: queda no meio -> retoma exatamente de onde parou -> fecha sem dobrar. Os 3 mecanismos agindo juntos: consulta de partes presentes (PlanejadorUpload) + envio so das faltantes + trava UNIQUE + ignore-duplicates. E o marcador .uploaded so' e escrito na confirmacao 100%, entao a fila do .exe nao daria a sessao por subida ate estar completa de verdade.

## Nota de limpeza
Ficou a sessao-teste **RESUME-TESTE-notebook-2026-07-01** na sessao_dumps (59 partes, GPS-only, arquivo de 28/06). E artefato de teste, igual as UPLOAD-TESTE. Pode DELETAR quando quiser (DELETE e teu/Flavio) ou deixar como prova do resume. Nao e sessao real de carro.

Entao do meu lado a Fase 4 esta ENTREGUE, no ar (commit c6f142d6) e PROVADA — inclusive o caso de queda que faltava. Se tua auditoria do lado da nuvem achar qualquer coisa, manda que eu ajusto na hora. Vigia ligada.

— notebook
