# Última tarefa — Menu de entrada do Command Box (launcher na TV/Fire Stick)

## 1. Pedido original do Flávio
Criar uma tela ANTES do Command Box: um MENU pra escolher o que ver no navegador da TV
(Fire Stick). Hoje o que está no ar é a Vista do Piloto. O menu chama essa tela e as outras
(Engenheiro, Frenagem & Aceleração que está sendo criada, etc.). Tela super hiper premium,
extremamente bonita, com a FOTO do carro Bubi (Celta) no fundo — a mesma do cadastro do carro.

## 2. Objetivo (1 frase)
Entregar um launcher premium, navegável pelo controle do Fire Stick, que abre cada visão do Command Box.

## 3. Critérios de conclusão
- Arquivo de menu criado, abre em navegador, full screen 16:9 de TV.
- Cards pras visões reais existentes (Piloto, Engenheiro, Comparar Voltas) + card "em construção" (Frenagem & Aceleração).
- Navegável por controle remoto (setas + OK) e por mouse/toque.
- Visual premium com identidade FAM Racing (Celta #80).
- Aberto no navegador pra validação.

## 4. Confirmação de leitura
- ~/.claude/CLAUDE.md: sim
- ~/.claude-decisoes/padroes.md: sim (existe)
- ~/.claude/FLAVIO_EXECUTION_PROTOCOL.md: sim (existe)
- ~/.claude/FLAVIO_DONE_CHECKLIST.md: sim (existe)
- ~/.claude/FLAVIO_ENVIRONMENT_RULES.md: sim (existe)
- ~/.claude/FLAVIO_COMMUNICATION_RULES.md: sim (existe)
- Projeto: CLAUDE.md do P1 Fast + memória

## 5. Plano (<=5 passos)
1. Inventariar telas existentes do Command Box (FEITO).
2. Criar menu premium navegável por controle remoto.
3. Ligar os cards às telas reais.
4. Abrir no navegador.
5. Pedir a foto real do carro ao Flávio (único item que não consigo verificar).

## 6. Arquivos/áreas
- _design-reference/menu-command-box.html (NOVO)
- Liga em: mockup-command-box-vista-piloto.html, -vista-engenheiro.html, -comparar-voltas.html

## 7. Ambiente alvo: desenvolvimento
## 8. Produção protegida: sim
## 9. Autorização para produção: não
## 10. Evidência da autorização: não recebida (NÃO republicar em command-box-tv.vercel.app sem ordem)
## 11. Riscos: a foto do carro não foi localizada na máquina/cadastro — usar placeholder premium até Flávio fornecer.
## 12. Status inicial: iniciado

---
## STATUS FINAL: CONCLUÍDO (menu premium com a FOTO REAL do Bubi no fundo) — 2026-06-27
- Menu criado e aberto no navegador: _design-reference/menu-command-box.html
- Cards ligados às telas reais existentes (Piloto, Engenheiro, Comparar Voltas) — links 200.
- Card "Frenagem & Aceleração" marcado "Em construção" (tela ainda sendo criada).
- Navegação por controle remoto (setas + OK) + mouse/toque implementada.
- ★ FOTO DO CARRO: LOCALIZADA E APLICADA (resolveu o bloqueio do registro anterior).
  A foto real do Bubi (Celta #80 FAM Racing, na pista) estava em
  `_design-reference/_backups/carro-foto-bolinha-641A81E7/641A81E7-3192-4E68-8183-B8401F105574.jpg`
  (foto do cadastro do carro). Copiada para `_design-reference/bubi.jpg` e ligada no menu
  (`--foto-carro: url('bubi.jpg')` + body.has-foto desliga o desenho provisório).
- Validado no navegador pela 8078 (foto e 3 telas-alvo respondem 200). Capturas em /tmp/menu-com-foto.png.
- NÃO republicado em command-box-tv.vercel.app (sem autorização de produção).
