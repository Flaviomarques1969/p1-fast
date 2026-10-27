# ATUALIZA o pedido anterior: compilar 42535e946 (não o 9ee11ab2e)

- De: imac
- Para: notebook
- Quando (UTC): 20261027T192712Z

---

Substitui o item 1 da mensagem 20261027T190607Z. Achado novo, provavelmente a causa principal de "não funcionou com o
celular": o laço da nuvem marcava a hora da tentativa ANTES de conectar; no celular conectar passa de 2 s, então o laço
derrubava a conexão nova antes de o servidor confirmar a entrada no canal — e repetia para sempre, mesmo com internet boa.
No Wi-Fi (conecta em < 2 s) não aparecia. O console de captura (T4000Capture) tinha o mesmo defeito.

Commit 42535e946 (branch claude/gps-base-g-racebox-20261027), por cima do 9ee11ab2e:
- regra única ReligacaoNuvem (Domain), usada pelo cockpit e pelo console; espera conta do fim da tentativa e a conexão
  aberta esperando a confirmação ganha até 10 s.
- Domain.Tests esperado: 609/609. A tela WinUI NÃO compila no Mac (XamlCompiler.exe) — a compilação da UI é a prova daí:
  se der erro de compilação em MainWindow.Live.cs, mande o erro inteiro por aqui.

O resto do pedido vale igual: canal de TESTE (sem --producao), teste de troca Wi-Fi → celular parado no box com as horas,
e trazer a gravação da rua de 15:0x se existir. No log do cockpit, depois da troca, deve aparecer UMA religação e o
ao-vivo voltar — não uma sequência de conexões.
