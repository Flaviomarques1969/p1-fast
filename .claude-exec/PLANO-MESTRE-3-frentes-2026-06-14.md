# PLANO MESTRE — 3 FRENTES P1 Fast (14/06/2026)

> Decisão do Flávio (14/06): "planeje fazer os três. aí dou clear e você executa todos
> passo a passo, um pedaço por vez até completar tudo."
> Este arquivo é o CONTRATO de execução. Sobrevive ao clear. Ao retomar: ler este arquivo,
> achar o primeiro pedaço com status `[ ]`, executar, marcar `[x]`, repetir até o fim.
> Estado real conferido por 3 agentes (arquivos abertos de verdade) — relatório em
> `relatorios/mapeamento-3-frentes-2026-06-14.json` se for regravado; resumo aqui embaixo.

## Regras desta campanha
- Ambiente alvo = DESENVOLVIMENTO. Produção (nuvem fvhwltzhytpnhlqbttmd) só em LEITURA.
- Nenhuma publicação no app no ar sem "MIGRAR PARA PRODUÇÃO" literal do Flávio.
- As únicas tocadas em produção aqui são: (a) leituras de conferência (read-only, permitido),
  (b) o Flávio usando o app normalmente no teste de sincronização (a sincronização já está no ar
  desde 03/06, com autorização da época). Nada de migration nova, deploy ou escrita por script.
- Sem inventar carga de freio: sem sensor físico, é ALVO/estimativa, sempre rotulado.
- Validação visual SEMPRE em velocidade real (regra do Flávio, rodada 20). Abrir no navegador.

## DECISÕES — FECHADAS (Flávio 14/06: "segue todas as recomendações")
> NÃO parar pra perguntar D1..D5 na execução. Usar a opção recomendada de cada uma (abaixo).
> Flávio pode reabrir qualquer uma depois; nenhuma é irreversível, nenhuma toca produção.
- **D1 (Frente A) — Critério do trail CERTO:** REC = **2 de 2** (seguiu o formato da melhor daquele
  trecho + mínima ainda freando); ponto de freada vira AVISO, não reprovação. Sobe pra 3 de 3 quando
  a pressão real entrar, sem mudar a tela. (Hoje, a 1 Hz por GPS, exigir 3 de 3 reprovaria passagem boa.)
- **D2 (Frente A) — Gráfico-alvo do freio:** REC = **híbrido** — contagem regressiva + colunas de luz
  sempre visíveis; o gráfico detalhado (verde/vermelho) só aparece quando há desvio. (Palco limpo por
  padrão; respeita leitura periférica em pista.)
- **D3 (Frente B) — Por onde o RaceBox entra:** REC = **notebook Windows** (centro de captura já
  confirmado por você 09/06: T4000 + RaceBox + DJI juntos, sai pela Starlink). Resolve a contradição:
  a especificação antiga diz "Mini PC" (arquivada 01/05) — desatualizada.
- **D4 (Frente C) — Como testar o envio:** REC = botão **"Sincronizar agora"** (vê o contador
  "Pendentes" zerar na hora; prova visual imediata).
- **D5 (Frente C) — Que mexida no teste:** REC = **+1 e depois −1** numa peça existente (saldo final
  igual, prova o caminho de movimentação sem mexer no estoque real).

---

## FRENTE A — Trail-braking pronto pro sensor de freio
Estado: cadeia trail-braking concluída; tipo_curva em produção. Hoje a carga de freio é estimada por
física do GPS. O módulo que lê o sensor real (`freio-trecho.js`) JÁ EXISTE e está bem feito (proxy,
detecção de presença do sensor, fusão por tempo), mas vive só em ambiente isolado e o caminho ao vivo
ainda não usa a pressão real. Sensor de pressão chega seg/ter 15-16/06.

- [ ] **A1 — Aplicar as decisões já fechadas do trail (D1 + D2).** D1=2 de 2; D2=híbrido (já
      decididas). Gravar na memória do projeto; refletir o critério do CERTO na avaliação do motor.
      Atualizar "Decisões em aberto" (3 → 0; a decisão 2 já estava resolvida pelas rodadas 11/19). [EU FAÇO]
      Critério pronto: decisões gravadas; seção atualizada; constante do motor reflete D1 (2 de 2).
- [ ] **A2 — Levar pressão/pedal do evento de amostra até o motor do trail.** Sem mudar a tela: só
      trafegar `pressaoFreioBar`/`pedalFreioPct` (já existem no parser e na transmissão) até o motor,
      casados por tempo. [EU FAÇO]
      Critério: console mostra o motor recebendo amostras de freio; bateria de testes verde; proxy
      GPS segue sendo a fonte até A3.
- [ ] **A3 — Ligar a fusão real (proxy → pressão).** Detectar presença do sensor; se houver, usar a
      pressão medida (fusão por tempo, tolerância 250 ms); senão, manter o GPS. Expor a "fonte do
      freio" (sensor-pressão / sensor-pedal / simulado-física) na tela. [EU FAÇO]
      Critério: teste novo — com pressão variável a fonte vira "sensor-pressão" e usa a pressão; com
      pressão zerada vira "simulado-física" e usa o GPS. Bateria verde. Rótulo de fonte muda na tela.
- [ ] **A4 — Stream de teste com pressão de freio não-nula.** Estender o simulador (hoje manda
      pressão 0) com uma freada realista (sobe na frenagem, residual na curva, solta na saída) +
      manter o perfil zerado pra testar o fallback. [EU FAÇO]
      Critério: no replay em DEV o cockpit alterna certo entre fonte sensor e fonte proxy; validado
      em velocidade real.
- [ ] **A5 — Validação visual no navegador (DEV).** Servir o cockpit-treino, abrir na tela exata,
      demonstrar a troca de fonte e a curva de freio mudando de estimativa pra medida. [VOCÊ no navegador]
      Critério: você vê a troca funcionando; 0 erro de console; aprovação registrada.
- [ ] **A6 — Incorporar à versão oficial.** Trazer `freio-trecho.js` + cockpit-treino dos ambientes
      isolados pra versão oficial, com testes ligados. Só depois de A5 aprovado. Backup do que existia. [EU FAÇO]
      Critério: arquivos na versão oficial; bateria verde com os testes novos; backup preservado.
- [ ] **A7 — Calibrar com o sensor físico real (seg/ter 15-16/06).** Conferir nos dados reais: faixa
      de pressão do Bubi, se o canal varia mesmo, conversão pressão → %. Ajustar só as constantes de
      calibração, sem mexer na lógica. [PRECISA DO SENSOR]
      Critério: em pista a fonte acusa "sensor-pressão"; a curva pintada bate com a freada real.

Confirmar na instalação: o canal do pedal (offset 54) e o de pressão (offset 268) correspondem ao
sensor físico do Bubi — hoje vêm de engenharia reversa, marcados "confirmar na instalação".

---

## FRENTE B — Integrar o RaceBox Mini S (GPS/IMU externo)
Estado: hardware testado e funcionando (25 Hz). No código, NADA do RaceBox foi feito — só a "casca de
espera" (a fonte 'racebox' já está prevista no sistema de telemetria). A especificação existe mas está
arquivada e desatualizada (diz Mini PC). Falta decidir por onde integra e construir a leitura.

- [ ] **B1 — Travar o ponto de integração (D3).** Card com os 3 caminhos + recomendação notebook
      Windows; registrar. Define a tecnologia da leitura. [VOCÊ DECIDE]
- [ ] **B3 — Decodificador do pacote (função pura).** Decodifica o pacote de 80 bytes em canais
      (lat/lng, velocidade, força G, giro, bateria) validando o checksum. [EU FAÇO]
      Critério: decodifica um pacote real capturado e bate com os valores; checksum inválido vira erro.
- [ ] **B4 — Teste automático do decodificador.** Casos da especificação que dependem só do
      decodificador (pacote válido, checksum inválido, duplicado, fora de ordem, bateria baixa). [EU FAÇO]
      Critério: teste passa; entra na bateria.
- [ ] **B2 — Confirmar sinal de GPS ao ar livre + versionar o leitor.** Recriar no projeto o script de
      leitura (hoje sumiu, ficou em /tmp), conectar perto de janela/ao ar livre, confirmar satélites. [EU FAÇO + ao ar livre]
      Critério: script versionado conecta no aparelho e mostra 4+ satélites com posição 3D; log salvo.
- [ ] **B5 — Driver de conexão (leitura contínua).** Conecta no aparelho e entrega o fluxo de pacotes
      ao decodificador; trata reconexão. Tecnologia depende de B1. [EU FAÇO + RaceBox ligado]
      Critério: 30s+ de fluxo contínuo sem queda; perda de conexão tenta reconectar.
- [ ] **B6 — Provedor que liga no sistema de telemetria.** Emite as amostras como fonte
      'racebox-gnss'/'racebox-imu' (nomes que o sistema já espera) e entra na escolha de melhor fonte. [EU FAÇO]
      Critério: com o RaceBox ligado, o sistema passa a escolher o RaceBox como fonte primária.
- [ ] **B7 — Testes de fluxo (falha/reconexão).** Buraco de sinal de GPS, drift do IMU, reconexão. [EU FAÇO]
      Critério: buraco de GPS rebaixa a qualidade mantendo a dinâmica pelo IMU; reconexão volta pra OK.
- [ ] **B8 — Atualizar a especificação e o registro de bloqueios.** Trocar "Mini PC" pelo ponto
      decidido, marcar canais como confirmados, reativar. PRESERVAR o texto antigo (histórico). [EU FAÇO]

---

## FRENTE C — Validar pendências antigas (sincronização estoque/manutenção + conferência da oficial)
Estado: infra de sincronização toda pronta e já no ar desde 03/06 (4 tabelas, função de envio, app
enfileira e drena). Faltam 2 validações ponta-a-ponta que dependem de você com o iPhone desbloqueado
na mão. Tem botão "Sincronizar agora" que força o envio e mostra "Pendentes" zerar. Nenhuma migration
nova é necessária; leitura da nuvem é só leitura.

- [ ] **C1 — Foto do estado atual da nuvem (leitura).** Contar as linhas das 4 tabelas hoje, pra
      comparar depois. [EU FAÇO — produção em leitura]
      Critério: 4 números registrados; nenhuma escrita.
- [ ] **C2 — Roteiro do teste manual (1 página, sem jargão) (D4 + D5).** Passo-a-passo: abrir o app,
      Hub do carro → Estoque, fazer +1/−1 numa peça, Sincronização → "Sincronizar agora", ver
      "Pendentes" zerar. [VOCÊ DECIDE o roteiro]
- [ ] **C3 — Você executa o teste com o iPhone desbloqueado.** A ação que está pendente desde 03/06. [VOCÊ no iPhone]
      Critério: você confirma que "Pendentes" zerou e o status ficou OK.
- [ ] **C4 — Confirmar na nuvem que o dado do teste chegou (leitura).** Comparar com a foto de C1. [EU FAÇO — produção em leitura]
      Critério: a diferença bate exatamente com a mexida (+2 movimentações).
- [ ] **C5 — Conferência visual da versão oficial no iPhone.** Hub / Estoque / Manutenção /
      Sincronização — confirmar que a oficial está igual ao que você aprovou. [VOCÊ no iPhone]
      Critério: você confirma tela por tela; divergência vira pendência nova.

---

## SEQUÊNCIA RECOMENDADA (linear, com os portões marcados)
**ETAPA 1 — fim de semana (autônomo + decisões rápidas):**
A1(decide) → A2 → A3 → A4 → A5(você navegador) → A6 · em paralelo posso adiantar:
C1(leitura) · B1(decide) → B3 → B4.

**ETAPA 2 — quando você puder, iPhone na mão:**
C2(decide) → C3(você) → C4(leitura) → C5(você).

**ETAPA 3 — seg/ter, com o sensor + indo à pista / ar livre:**
A7(sensor) · B2(ar livre) → B5 → B6 → B7 → B8.

## O QUE PRECISA DE VOCÊ (resumo)
- Decisões rápidas: D1, D2 (Frente A) · D3 (Frente B) · D4, D5 (Frente C).
- Mão no iPhone: C3 (teste de sincronização) · C5 (conferência visual).
- Olho no navegador: A5 (troca de fonte do freio).
- Hardware/janela: A7 (sensor instalado, seg/ter) · B2 (sinal de GPS ao ar livre).

## NÃO VERIFICADO (declarado, regra não inventar)
- Data exata do sensor (seg/ter) é informação externa, não confere por arquivo.
- Offsets 54/268 = freio físico do Bubi vêm de engenharia reversa; confirmar na instalação.
- Layout binário oficial do RaceBox: validar contra pacote real capturado (não confiar só na memória).
- Sinal de GPS do RaceBox ao ar livre: só testado dentro do escritório até agora.
- Versão instalada AGORA no iPhone: só dá pra confirmar com o aparelho conectado.
