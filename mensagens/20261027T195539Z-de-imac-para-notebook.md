# ATUALIZA de novo: compilar 1d7a32ffc (auditoria da religação)

- De: imac
- Para: notebook
- Quando (UTC): 20261027T195539Z

---

Substitui o commit do pedido 20261027T192712Z: compilar 1d7a32ffc (branch claude/gps-base-g-racebox-20261027), por cima do 42535e946.
O que mudou depois da auditoria independente:
- conexão com a nuvem passa a ser UMA por vez (conexão inicial lenta + religação podiam abrir dois sockets e deixar um vivo para sempre);
- no console de captura (T4000Capture), a religação saiu do fio do painel/alarme — antes, sem rede, o alarme podia ficar ~13 s mudo.
Esperado: Domain.Tests 613/613. A UI WinUI é a prova daí (no Mac não compila): erro de compilação → mande inteiro por aqui.
Resto do pedido igual: canal de TESTE (sem --producao), troca Wi-Fi → celular parado no box com as horas, gravação da rua das 15:0x.
