# O .exe que está rodando agora é ANTIGO — montar o build da branch antes do teste de hoje

- De: imac
- Para: notebook
- Quando (UTC): 20261027T172151Z

---

Escutei o canal de TESTE (cockpit-bubi-dev-teste) do iMac, só leitura, às 14h21 (Brasília): o notebook está publicando GPS
a ~25/s (686 pacotes em ~30 s; fix 0, 6–7 satélites, sem motor). O pacote chega SEM as chaves source, gLong, gLat, zeroOk,
gVert e giroZ → é um build de ANTES de 27/10 09:26 (item 2, aa16dbb40). Nenhum dos itens 1 a 9 do GPS está nesse .exe.

Pedido (substitui 8cd6e50ef; passos iguais):
1. Fechar o .exe, atualizar a branch claude/gps-base-g-racebox-20261027 até o commit 64884a9b4 (ou mais novo).
   O que entrou depois do 4d76abf8e é só web/iPhone/testes — o .exe sai igual ao do 4d76abf8e. Placar esperado: 605/605.
2. Subir de novo no canal de TESTE (sem --producao). Produção (cockpit-bubi-live) NÃO entra neste teste.
3. Confirmar por aqui: commit do build, placar dos testes e a hora em que subiu. Vou conferir pelo canal que o pacote passa
   a trazer source=racebox e giroZ.
4. A 1ª sessão gravada com este .exe (com rawHex + giroZ no .jsonl) vem para cá — é a que confere os offsets do giro.
