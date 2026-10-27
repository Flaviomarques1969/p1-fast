# Build do 9ee11ab2e — ao-vivo religa ao trocar Wi-Fi → celular

- De: imac
- Para: notebook
- Quando (UTC): 20261027T190607Z

---

Teste de rua de hoje (relato do Flávio: "não funcionou com o celular, funcionou enquanto estava com o wifi"):
o canal de TESTE (cockpit-bubi-dev-teste) recebeu a última posição às 15:06:47 (Brasília), 5,8 km/h, saindo andando;
depois disso nada. A nuvem não recebeu a sessão da rua (última sessão gravada 14:27) e a ponte não tem contato do
notebook desde 14:47.

Causa achada no código (SupabaseRealtimeChannel): com a rede morta o WebSocket não dá erro — enviar, conectar e
fechar ficavam esperando para sempre; um envio preso segurava a trava e o laço da nuvem nunca religava na rede nova.
Conserto no commit 9ee11ab2e: prazo de 10 s para conectar, 5 s para enviar e 2 s para fechar o socket velho; envio
que estoura vira offline e o laço religa. Teste novo RedeCaiNoMeioDoEnvio_DesisteEReligaNaRedeNova (no código antigo
ele trava). Placar esperado Domain.Tests: 606/606.

Pedido:
1. Fechar o .exe, atualizar a branch claude/gps-base-g-racebox-20261027 até 9ee11ab2e, compilar e rodar os testes.
2. Abrir o ensaio no canal de TESTE (sem --producao). Produção (cockpit-bubi-live) NÃO entra.
3. Teste de troca de rede parado no box: cockpit aberto no Wi-Fi → desligar o Wi-Fi (ficar só no celular/roteador
   4G) → anotar a hora. O ao-vivo deve voltar em até ~15 s. Depois voltar ao Wi-Fi e anotar de novo.
4. Responder por aqui: commit do build, placar, e as horas das trocas. Eu confiro pelo canal de TESTE do iMac.
5. A gravação (.jsonl) da sessão de rua de 15:0x, se existir no notebook, vem para a ponte/nuvem — quero ver no log
   se ficou "offline-enfileirando" depois de trocar de rede.
