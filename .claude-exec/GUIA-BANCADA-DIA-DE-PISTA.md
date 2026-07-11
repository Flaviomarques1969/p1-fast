# Guia de bancada — "Dia de pista" P1 Fast

> Passo a passo do que plugar no notebook + carro e o que tem que aparecer na tela.
> Escrito a partir do código real (console de captura `p1fast-t4000-capture` + tela WinUI).
> Tudo o que está abaixo de "PRODUÇÃO" só vale com a frase **MIGRAR PARA PRODUÇÃO**.

---

## Antes de ir pro carro — provar a internet (sem carro)

Serve pra garantir, no escritório, que o notebook fala com a nuvem.

1. Definir a chave da nuvem (uma vez por sessão do terminal):
   `setx P1FAST_SUPABASE_ANON "<a chave anon>"` (ou no terminal: `$env:P1FAST_SUPABASE_ANON="..."`)
2. Rodar: `p1fast-t4000-capture --nuvem-teste`
3. **O que tem que aparecer:** uma linha por amostra com `online=True` e, no fim,
   **"OK — o notebook FALA com a nuvem (canal de teste)."**
   - Se aparecer "FALHOU": internet, chave ou URL. Não é problema do carro.
   - Este modo NUNCA toca o canal de produção (recusa por segurança).

---

## Na bancada — carro + notebook

### 1. Energia e cabo
- Carro com a **chave em ON** (não só "Acessórios") — a central T4000 precisa estar **alimentada**.
- Cabo **USB‑C ↔ USB‑C** da T4000 no notebook. (Injeção lê‑se por USB, **nunca** CAN.)

### 2. Ver se o Windows enxerga a T4000
- Rodar: `p1fast-t4000-capture --diag`
- **O que tem que aparecer:** o relatório lista os cabos USB plugados e tenta marcar o
  **candidato T4000**. Três desfechos:
  - lista o candidato → seguir pro passo 3;
  - mostra **"SEM DRIVER"** → instalar o driver do chip (FTDI / CH340 / Silicon Labs / Prolific);
  - **0 dispositivos** → cabo não está plugado / central desligada.

### 3. Gravar só o motor (sem nuvem ainda)
- Rodar: `p1fast-t4000-capture --gravar`
- **O que tem que aparecer**, a cada segundo:
  `gravando=sim  motor=<sobe>  (≈10 Hz)  lacunas=0  descartadas=0`
- Acelerar o motor e ver o número de amostras subir (sinal de vida real).
- `Q` ou `Esc` pra parar. No fim ele mostra a sessão gravada + a conferência de integridade.
- Conferir depois: `p1fast-t4000-capture --conferir`
  - **O que tem que aparecer:** uma linha por sessão com nº de amostras, sequência e lacunas.
- Onde fica gravado: `C:\Users\<você>\p1fast-sessoes\` (cada sessão é um arquivo `.jsonl`).
  - Isso é a **fonte da verdade** — grava em disco ANTES de qualquer rede; não perde se a internet cair.

### 4. Gravar + mandar pra nuvem de TESTE
- Rodar: `p1fast-t4000-capture --gravar --nuvem`
- **O que tem que aparecer:** além da linha do passo 3, `nuvem=...  enviadas=<sobe>  fila=0`.
  - Se a internet cair, `fila` sobe e a nuvem **religa sozinha**; quando volta, drena a fila (não perde).
  - Sem `--producao`, vai pro canal de teste — não aparece pra ninguém. É seguro repetir à vontade.

### 5. PRODUÇÃO (só na pista, só com a frase)
- **Trava:** só rode isto depois de me mandar **"MIGRAR PARA PRODUÇÃO: captura ao vivo na pista"**.
- Rodar: `p1fast-t4000-capture --gravar --nuvem --producao`
  - Publica no canal **cockpit-bubi-live** (o que o app no celular e a tela do box assistem ao vivo).
  - Exige a chave em `P1FAST_SUPABASE_ANON`.

---

## A tela do piloto (.exe WinUI) — estado e o que falta

**Hoje:** o programa da tela existe e roda em **modo demonstração** (`--demo` passa 4 voltas fictícias).
Falta a sessão do Claude **no notebook** ligar a tela no feed real (a costura `CapturaDiaDePista`):
criar a captura, mandar cada amostra do motor (USB) e cada ponto de GPS pra ela. Isso só compila no
Windows — por isso é tarefa da sessão do notebook, não daqui do Mac.

**Quando estiver ligada, o que aparece na tela (já está no código WinUI):**
- **Luz de marcha** que enche do centro pra fora; no "subiu de marcha" pisca branco.
- **Número Delta** (ganho/perda de tempo) + frase de **ação/coach** do trecho.
- **Quatro pontos do ápice**: entrada (km/h), freio (metros: atual/ref), ápice (km/h), saída (km/h).
- **Bloco de alerta**: mensagem do sistema (azul) ou **grave** (vermelho, pulsando).
- **Barra de stint** (blocos por volta: cinza=ainda não rodou, verde=melhor, vermelho=pior, ouro=recorde).

**Captura automática (já portada e provada):** assim que o carro passa de **15 km/h** começa a gravar
sozinho; quando fica **12 s parado abaixo de 6 km/h** (box), fecha a sessão. Marcha lenta no box NÃO
vira sessão. Esses dois números (15 km/h e 12 s) são pra **calibrar na pista** com o carro de verdade.

---

## ✅ Decisão tomada (Flávio, 24/06): portar as 17 luzes

- A luz de marcha da tela WinUI tinha **12 luzes**; a versão aprovada em 22/06 tem **17**. Flávio
  decidiu **portar as 17 antes do dia de pista**. A instrução foi entregue à sessão do notebook
  (`.claude-exec/BRIEFING-NOTEBOOK-17-LUZES.md`) — em execução por lá, com testes + foto de prova.

---

## Resumo de quem faz o quê

| Item | Estado | De quem |
|------|--------|---------|
| Provar a internet (sem carro) | pronto (`--nuvem-teste`) | Flávio rodar na bancada |
| Diagnóstico USB | pronto (`--diag`) | Flávio rodar na bancada |
| Gravar motor em disco | pronto e provado (`--gravar`) | Flávio rodar na bancada |
| Gravar + nuvem teste | pronto e provado (`--gravar --nuvem`) | Flávio rodar na bancada |
| Nuvem produção | pronto, **travado** atrás de "MIGRAR PARA PRODUÇÃO" | só na pista |
| Tela do piloto ligada no feed real | **falta** (só compila no Windows) | sessão do notebook |
| GPS do iPhone chegando ao notebook | **falta** | sessão do notebook + iPhone |
| Curvas de Brasília no painel | **falta** (opcional p/ luz+alerta funcionarem) | sessão do notebook |
| Calibrar 15 km/h e 12 s | **falta** | Flávio, na pista |
| 17 luzes no WinUI (vs 12 hoje) | **decidido (portar 17)** — em execução | sessão do notebook |
