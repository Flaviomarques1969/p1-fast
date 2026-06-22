# COCKPIT DO PILOTO — FONTE DA VERDADE

> **O contrato único: dos dados (injeção + GPS) até a tela do piloto acendendo.**
> Esta é a primeira página a ler antes de qualquer trabalho no cockpit do piloto.
> Se algo aqui contradiz outro documento, **avisar o Flávio** — não escolher em silêncio.
> Estado verificado em 22/06/2026 (código real + testes re-rodados; fontes no rodapé).

---

## 1. O que é o cockpit do piloto
A tela que **o piloto vê dentro do carro**, num notebook Windows com tela de 10,5".
**Não confundir** com as outras duas telas:
- **App do celular** — planejamento de stint, gestão da garagem, ver dados ao vivo.
- **Command Box** — a TV de 32" no box (só mostra; não decide nada).

## 2. De onde vêm os dados (3 fontes no carro)
1. **Motor / injeção Injepro (você chama de T4000)** — lida pela **USB** do notebook.
   _Decisão 21/06: lê-se por USB, nunca por CAN. No código o protocolo USB aparece como "T3000" — é o mesmo aparelho._
2. **GPS** — hoje pelo **iPhone** (1 vez por segundo). O **RaceBox** (25× por segundo, bem mais preciso) já está
   programado e é a melhoria futura — entra quando for validado na pista; não é obrigatório pro primeiro funcionamento.
3. **Câmera** (Osmo / iPhone) — é vídeo, vai por outro caminho (Daily.co); fica **fora** do painel de números.

## 3. O caminho do dado (uma linha)
**Carro → notebook Windows** (lê pela USB, **grava em disco à prova de queda**, e **calcula** o que o piloto vê) **→ a tela do piloto acende.**
Em paralelo, o notebook **manda ao vivo pra nuvem** (canal `cockpit-bubi-live`), e é dali que o **app do celular** e o **Command Box** bebem.

## 4. O que a tela do piloto mostra (os requisitos já decididos)
- **Luz de marcha** — 17 luzes; troca na **potência máxima (6.050 rpm)**, não no torque, não no redline (6.350 é só sirene).
- **Em qual curva o carro está** — reconhece as 8 curvas de Brasília, na ordem.
- **Bolinha do ápice** — aponta pra onde estava o ápice ideal ("siga a bolinha").
- **Comparação por trecho + frase do coach** — entrada / freio / ápice / saída, contra a melhor passagem (ex.: "FREOU CEDO").
- **Mensagens e alertas críticos** — sensor que não existe **nunca** dispara alerta falso; mistura/bateria só alertam com o **carro andando**.
- **Sem Vmin no painel do piloto** (o Vmin vive no bloco dedicado, não aqui).

## 5. Onde o cálculo mora
**No notebook** (para o cockpit do piloto). A **nuvem** só serve o app do celular e o Command Box.
**Não duplicar** o cálculo. O Command Box **não calcula** — só exibe.

## 6. O que JÁ está pronto e provado (no meu lado, por teste e por "replay")
- **Leitura da injeção pela USB** + **gravação local à prova de queda** + **envio ao vivo pra nuvem**: existem e estão provados por testes.
- **O cérebro completo** (luz de marcha, qual curva, bolinha do ápice, comparação por trecho, frases do coach, alertas):
  provado na **sua volta real de 2:39 (domingo 21/06)** — **255 testes passando** (1 falha cosmética de vírgula no Mac, sem efeito na lógica; re-rodado 22/06).
- **A tela do piloto** já está codificada com as entradas certas para receber motor e GPS ao vivo.

## 7. O ÚNICO degrau que falta pra VOCÊ ver funcionar
**Rodar no notebook Windows:** montar a tela + plugar a entrada de dados e ver acender.
**Isso não roda no meu lado (Mac)** — a tela do piloto é tecnologia Windows.
- **Atalho sem ir pra pista:** usar o **replay da sua volta de 2:39** alimentando a tela → você vê o painel reagindo **na bancada**, repetível, quantas vezes quiser.
- **Na pista:** a mesma tela, alimentada pela USB do carro ao vivo.

## 8. Como a gente prova que "está funcionando"
A tela acende no Windows e, durante a volta (replay ou ao vivo):
a luz de marcha sobe com o RPM · a curva certa aparece · a bolinha do ápice se move · a frase do coach muda a cada trecho · sem alerta falso.
- Com **replay** da volta real = prova na bancada.
- Com **USB do carro** = prova na pista.

## 9. Regras que NÃO se reabrem
- Luz de marcha troca na **potência máxima (6.050 rpm)** — nunca no torque, nunca no redline.
- As **17 luzes** são só do painel do **piloto**. O Command Box nunca vai pras 17 (é tela mais simples).
- Cálculo do cockpit mora **no notebook**; nuvem só pra celular + Command Box.
- **Command Box é só visualização** — nenhum botão de ação.
- Cockpit do piloto ≠ Command Box ≠ app do celular. Não misturar.
- **Sem Vmin** no painel do piloto.
- Injeção lê-se por **USB**, não CAN.
- `cockpit-bubi-live` é **produção**: ouvir pode; **publicar dev/replay nele, não** (sem autorização literal).
- Sem emojis (só ícones de traço); tela **10,5"** (não formato celular); usar a **largura toda**.

## 10. Pontos a confirmar / lacunas reais (honestidade)
- **Fila da nuvem na queda de internet:** a captura ponta-a-ponta do notebook já reenfileira (provado 22/06), mas há
  uma fila antiga separada (do app de estoque) ainda sem o "drenador". Não confundir as duas.
- **Posição do carro no desenho da pista** (GPS → x,y): é calculada na nuvem, mas ainda não aparece em nenhuma tela.
- **Sensores físicos de pneu e câmbio:** o código já espera por eles; faltam ser instalados no carro.

---

### Verificado em (fontes — para auditoria)
- Arquitetura/caminho do dado: `docs/ARQUITETURA_DEFINITIVA.md`, `docs/FONTE_DADOS_AO_VIVO.md`, `docs/PADRAO_CENTRAL_DADOS_AO_VIVO.md`.
- Cérebro (Windows/C#): `windows/cockpit/P1Fast.Cockpit.Domain/` (AlertasCriticos.cs, Ghost.cs, DeltaCoach.cs, TrechoDetector.cs, CockpitOrchestrator.cs).
- Testes: `windows/cockpit/P1Fast.Cockpit.Domain.Tests/` — re-rodado 22/06: **255 aprovados / 1 falha (PAN_04, vírgula no Mac) / 256 total**.
- Tela (Windows/WinUI): `windows/cockpit/.../MainWindow.xaml.cs` — entradas `IniciarFeedReal` / `AlimentarMotor` / `AlimentarGps`.
- Protótipo/spec executável: `web/cockpit/` (cockpit-state.js, cloud-bridge.js, main-t3000.js, index-t3000.html).
- Captura/entrada: `windows/cockpit/P1Fast.Cockpit.Domain/SessionRecorder.cs`, `src/telemetry/`, `web/cockpit/cloud-bridge.js`.
- Decisões duras: `P1 Fast/CLAUDE.md`, `ARCHITECTURE_DECISIONS.md`, e a memória do projeto.
