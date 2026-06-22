# Última tarefa — Configurador de Trecho (Garagem → Trechos) — 22/06/2026

## 1. Pedido original de Flávio
"em p1 fast quando selecionamos garagem, trechos, não consigo sair antes de concluir os trechos e o ápice deve ficar na parte mais interna da curva. não no meio da pista."
+ "ou salvar até onde foi alterado. não somente no final."
+ "e depois de salvo voltar a tela primeira daquela função."

## 2. Objetivo (1 frase)
Destravar a saída do configurador de trechos, permitir salvar o que já foi alterado em qualquer trecho (voltando à lista depois de salvar) e fazer o ápice grudar na parte interna da curva, não no eixo central.

## 3. Critérios objetivos de conclusão
- A) Dá pra sair do configurador a qualquer momento, sem percorrer todos os trechos.
- B) "Salvar e voltar" disponível em TODO trecho (hoje só no último); salva o que foi alterado.
- C) Depois de salvar, volta pra primeira tela da função (lista de trechos).
- D) O ápice fica desenhado/gravado na borda interna da curva, não no meio da pista.
- E) Compila sem erro. Ápice já configurado pelo usuário é preservado.

## 4. Leitura dos arquivos obrigatórios — confirmação
- ~/.claude/CLAUDE.md: lido
- ~/.claude-decisoes/padroes.md: lido (sem decisões registradas)
- ~/.claude/FLAVIO_EXECUTION_PROTOCOL.md: lido
- ~/.claude/FLAVIO_DONE_CHECKLIST.md: lido
- ~/.claude/FLAVIO_ENVIRONMENT_RULES.md: lido
- ~/.claude/FLAVIO_COMMUNICATION_RULES.md: lido
- (extra) P1 Fast/CLAUDE.md + memória do projeto: lidos

## 5. Plano
1. Destravar saída: fallback de fechamento (Environment dismiss) no ConfiguradorTrechoView → volta pra lista.
2. Reorganizar a barra: "Salvar e voltar" (salva + volta pra lista) em todo trecho; navegação Anterior/Próximo salva antes de mover (não perde ajuste); Cancelar sai sem salvar.
3. Ápice na borda interna: snap centrípeto no arraste, no "adicionar ápice" e na semente padrão.
4. Ajustar texto de ajuda do ápice.
5. Compilar (simulador) + reportar pra Flávio validar no iPhone.

## 6. Arquivos inspecionados
- ios/p1fast-ios/Sources/Views/ConfiguradorTrechoView.swift (editor — alvo)
- ios/p1fast-ios/Sources/Views/TrechoListaView.swift (abre o editor com onClose:nil via NavigationLink)
- ios/p1fast-ios/Sources/Views/GaragemView.swift (botão "Trechos da pista" → sheet com NavigationStack → lista)
- ios/p1fast-core/.../ErrorClassifier.swift (consome a referência de ápice — NÃO ligado em tela hoje)

## 7. Ambiente alvo
desenvolvimento (app iOS, nada em produção)

## 8. Produção protegida
sim

## 9. Autorização para produção
não

## 10. Evidência da autorização para produção
não recebida

## 11. Riscos
- O ápice é a referência que o classificador de pilotagem (ErrorClassifier: "apex interno demais"/"apex perdido por fora") usaria. Hoje NÃO está ligado em tela → mover o ponto não muda nada visível pro piloto agora; alinha a referência futura (mais correto).
- Texto de ajuda dizia "não é o ponto mais interno geométrico" — ajustado e sinalizado (contradição documentada).
- Ápices já configurados pelo usuário NÃO são movidos automaticamente (preservação). Só semente/arraste/novo usam o snap interno.
- Código morto substituído (save/saveAndAdvance → persistThen/saveAndClose/saveThen*).

## 12. Status
em andamento
