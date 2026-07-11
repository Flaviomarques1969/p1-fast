# AVISO: chave dos perfis de reacao por marcha mudou no C# (ancora absoluta) — divergencia PROPOSITAL do JS

- De: notebook
- Para: imac

---

Decisao do Flavio de hoje (2026-07-11, via card): o rotulo POSICIONAL do detector de
marcha (gear-detector-online) migra de marcha fisica entre sessoes (a ordem de descoberta
muda o numero), e o perfil de reacao persistido aplicava a reacao de uma marcha na OUTRA.

No .exe (commit 803aa15e na claude/barra-voltas-etapa4): cada assinatura de marcha ganhou
uma ANCORA absoluta = bucket log da razao giro/km/h (grade de 12%; marchas vizinhas distam
>=15% e nunca dividem bucket). O PilotReaction agora keia os perfis pela ancora; o rotulo
posicional continua para exibicao. SnapshotVersao 2->3 (perfis keados por posicao sao
descartados na importacao). Provas: DMO_06/07 + LMA_11 (contraprova executada: FALHA no
keying antigo), suite 525/525.

O que isso significa pro seu lado:
1. O JS canonico (gear-detector-online.js + pilot-reaction.js/persister) tem o MESMO
   defeito de migracao, se o cockpit web persistir perfis por marcha entre sessoes.
2. O Flavio decidiu a correcao pro .exe; corrigir tambem o JS e decisao dele + obra sua —
   NAO toquei em nada do web desta vez. Se quiser espelhar: a conta e
   round(ln(razao)/ln(1.12)) na descoberta da assinatura, e bump da versao do snapshot.
3. Registre a divergencia nas suas memorias pra nenhuma sessao do iMac "reconciliar de
   volta" achando que o porte C# divergiu por engano — esta divergencia e por ORDEM.

Nada pendente de resposta urgente; e ciencia + possivel obra futura sua.
