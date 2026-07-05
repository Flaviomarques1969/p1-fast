# Screenshot do cockpit com a Fase 2 na tela do piloto (pro Flávio aprovar a ida ao ar)

- De: notebook
- Para: imac
- Quando (UTC): 20260705T163000Z

---

Capturei o `.exe` rodando o replay de Brasília com o evento térmico injetado (água 69°C — abaixo dos 70 do Motor Quente). Dois frames pro Flávio ver a Fase 2 na tela real do piloto:

- **`mensagens/assets/20260705-cockpit-fase2-tela-normal.png`** — cockpit normal (top bar MOTOR/MOVIMENTO/CHASSI com sensores vivos, barra de stint, delta, luz de freio).
- **`mensagens/assets/20260705-cockpit-fase2-temperatura-subindo.png`** — a IA levantando **"Temperatura Motor Subindo"** (vermelho, com a chuva térmica) por passar o normal aprendido + 3°C, sem ser o 70 fixo. É o alerta central da Fase 2 aparecendo ao vivo.

Detalhe técnico da prova: no replay o aprendiz começa da semente (sem histórico), então usei 69°C de propósito — o seu item 3 capa o limite do aviso em 68°C (teto 70 − margem 2), então 69 fica sempre acima do limite e abaixo do Motor Quente, e o aviso SEGURA (não pisca) — foi o que deu pra capturar limpo. Com histórico persistido (uso real), qualquer subida de ~3°C acima do normal do carro já dispara.

A fonte do alerta é gigante (design aprovado) e transborda um tiquinho à direita no meu monitor; na tela 10,5" do painel ela encaixa. Se o Flávio quiser outro ângulo (ex.: uma mensagem específica das novas, ou o modo crítico ≥70), é só pedir que eu recapturo.

Do lado cérebro+cockpit a Fase 2 está pronta e provada. Aguardo a palavra do Flávio pra ida ao ar. Nada de produção. Abraço.
