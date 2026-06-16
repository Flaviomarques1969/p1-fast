# TASK_INIT — Teste dos aparelhos (sensores T4000, GPS RaceBox, câmera Osmo 6) — 2026-06-16

## Pedido original (Flávio, esta sessão)
"Quero fazer o teste no notebook dos sensores, gps, osmo 6. E quero que você registre os dados,
os formatos, de forma online corrija problemas, teste novamente até tudo que estiver ativo funcionar."

## Objetivo (1 frase)
Rodar o teste de ponta a ponta das 3 fontes de dado do carro (T4000 por USB, RaceBox/GPS por Bluetooth,
Osmo Action 6 como webcam USB), registrando dado bruto + formato de cada uma, corrigindo ao vivo e
repetindo até cada aparelho ATIVO acender verde.

## Critérios objetivos de conclusão
1. Cada aparelho conectado lê dado de verdade (não congelado, não simulado) e mostra verde no quadro.
2. Para cada fonte ativa: dado bruto + formato decodificado ficam REGISTRADOS (com prova/arquivo).
3. Problema encontrado vira correção testada na hora; re-teste confirma.
4. Nada em produção sem autorização literal. Páginas publicadas (p1tv/p1t4000) não são alteradas no ar sem ok.

## Leitura confirmada (todos lidos nesta sessão)
- ~/.claude/CLAUDE.md: sim
- ~/.claude-decisoes/padroes.md: sim (vazio — 0 decisões)
- ~/.claude/FLAVIO_EXECUTION_PROTOCOL.md: sim
- ~/.claude/FLAVIO_DONE_CHECKLIST.md: sim
- ~/.claude/FLAVIO_ENVIRONMENT_RULES.md: sim
- ~/.claude/FLAVIO_COMMUNICATION_RULES.md: sim
- Projeto: CLAUDE.md, docs/ARQUITETURA_DEFINITIVA.md, docs/CHECKLIST_DIA_DE_PISTA.md,
  docs/HANDOFF_T4000_NOTEBOOK_2026-05-25.md, docs/hardware/{T4000_CAN_SPEC,RACEBOX_INTEGRATION_SPEC}.md,
  web/teste-aparelhos/index.html (= p1tv.vercel.app, "Central de Pista"): sim

## Fatos verificados (com prova)
- Máquina desta sessão: Mac mini M2 Pro "Mac FAM" (Mac14,12) — É UM DESKTOP, não o notebook.
- Nada relevante conectado AQUI agora: 0 dispositivos USB; nenhuma porta serial além de Bluetooth/console;
  Bluetooth só com mouse + headset. (system_profiler SPUSBDataType vazio; ls /dev/cu.* só Bluetooth/debug.)
- Pelo projeto, as 3 fontes plugam no NOTEBOOK WINDOWS da pista: T4000 USB · Osmo 6 USB (webcam) · RaceBox Bluetooth.
- O teste real roda no NAVEGADOR do notebook, em 2 páginas que já existem:
  p1t4000.vercel.app (lê T4000/T3000 por USB) + p1tv.vercel.app (câmera + GPS + confirma carro; quadro 4 luzes).
- Decodificadores já passam nos testes automáticos: T4000 27/0, parser USB T3000 21/0 (saída real conferida).
- Lacuna: a página MOSTRA o dado mas NÃO grava dado bruto + formato pra depurar leitura errada (não há registrador/baixar).

## Plano (<=5 passos) — depende da resposta de Flávio sobre onde rodar
1. Confirmar em qual máquina os aparelhos vão ser ligados (Mac mini desta sessão x notebook Windows).
2. Servir/abrir o banco de testes e o registrador na máquina certa.
3. Para cada aparelho ativo: ler, registrar dado bruto + formato, achar problema, corrigir, re-testar.
4. Rodar testes automáticos a cada correção (saída real).
5. Reportar em TASK_DONE com prova por aparelho.

## Ambiente
- Ambiente alvo: desenvolvimento
- Produção protegida: sim
- Autorização para produção: não
- Evidência da autorização: não recebida

## Riscos
- Aparelhos não estão neste Mac; se a intenção é o notebook Windows, não dá pra eu dirigir o navegador dele daqui.
- USB do T4000 só foi confirmado lendo no Windows (handoff 25/05); no Mac pode não abrir.
- Não misturar dado de teste com real (simulador desliga sozinho quando carro real aparece — já implementado).
- Páginas p1tv/p1t4000 estão publicadas; não republicar no ar sem "MIGRAR PARA PRODUÇÃO".

## Status inicial: iniciado — aguardando Flávio confirmar a máquina onde os aparelhos serão ligados.
