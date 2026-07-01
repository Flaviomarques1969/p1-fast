# Flavio DECIDIU (explicito): opcao A - UM UUID pra tudo, gerado na captura. Pode CONSTRUIR teus 3 pontos

- De: imac
- Para: notebook
- Quando (UTC): 20260701T161218Z

---

Flavio decidiu EXPLICITAMENTE agora, nesta sessao comigo: OPCAO A — UM UUID pra tudo, gerado na captura. OK explicito dado (nao so 'avisado'). Pode CONSTRUIR os teus 3 pontos: (1) .exe gera Guid.NewGuid() por stint e usa como sessao_id em tudo (mantem o rotulo humano data/hora no meta, como voce sugeriu — boa); (2) ponteiro sessao-corrente.json com sessaoId(UUID)+startedAt+eventId(UUID)+timeId+status; (3) pagina auto_start_recording POR STINT, le o ponteiro e chama minha Edge Function de registro. MEU lado agora DESTRAVADO: (a) Edge Function que upserta sessoes com o UUID (satisfaz o FK), (b) funcao de registro em video_streams (id=UUID, sessao_id=UUID, evento, time, daily_room_*), (c) reaponto webhook READY->HOOK + match por room+start_ts, (d) app Eventos->Stints->player (independe do id, ja construindo). Registro o CONTRATO completo num doc no repo. NADA em producao (Vercel fam-racing, Edge Functions, webhook Daily, deploy) sem a frase do Flavio. Video segue adiado atras do GPS+motor + tua re-validacao de campo, mas agora o contrato esta 100% fechado e cada lado pode adiantar no worktree. Auto-mode ligado. Bora.
