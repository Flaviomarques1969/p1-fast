# CONTINUAR — Pendências + Estoque (DESIGN APROVADO 2026-06-14)

Flávio aprovou ("sim") o desenho COMPLETO. Construir no app (DEV) em estágios.
Mockup final aprovado: `_design-reference/mockup-pendencias-estoque-APROVADO-2026-06-14.html`
(snapshot de `mockup-menu-reorg.html` na aprovação.)

## JÁ FEITO E NO APP (DEV) — parte 1 (menu reorg)
- Menu: Home · Eventos · **Pendências** · Garagem (TASK_DONE).
- Garagem com sub-abas (Carros · Pilotos · Passageiros · Combustível · Lições).
- Pendências abre no próximo evento; 6 grupos reais (45 itens); ticar; incluir/excluir extra LOCAL-ONLY (`evento_pendencias_extra`); cor por categoria.
Arquivos: HomeView, GaragemView, PessoasView, PendenciasView, PendenciaRepository, Models, Migrations (v29), HubMockLauncher, schema-parity test.

## FALTA CONSTRUIR (design aprovado) — parte 2

### A) ESTOQUE (modelo de dados central)
- **Garagem = Carros + Estoque geral** (nova sub-aba "Estoque geral" na Garagem).
- **Estoque do carro** JÁ EXISTE: CarroHubView → "Estoque do carro" → PecaListaView/PecaRepository. `Peca`: carroId, nome, especificacao, quantidade, area, tipo, codigo, preco. **Peca SINCRONIZA com a nuvem (produção).**
- **Item unificado** com **escopo**: Estoque geral OU Estoque do carro X. Cadastrável de 3 lugares (circular): carro, estoque geral, ou direto na Pendência.
- "Onde fica" = **botões**: [Estoque geral] + **1 botão por carro** (dinâmico; hoje só "Celta 1.4"). Preparar pra N carros.
- Campo **Item ou Ferramenta** (botões).
- **Quantidade mora no estoque**; a Pendência puxa dela. "peguei" é por evento.

### B) EDITOR de item unificado (tudo em BOTÕES, menos Bloco que é lista de 6)
Campos na ordem do mockup: foto(OCR) · Nome · Onde fica(escopo) · Item/Ferramenta · Bloco · Categoria(Obrigatório/Desejável) · Especificação · Como conta(Simples/Embalagens/Conjunto) · Quantidade|Volume+unid+nº embalagens|Peças.
- **Câmera "Tirar foto e ler o item"** (OCR do rótulo preenche): app já tem `EtiquetaOCR.swift`, `BarcodeScannerView`, `CameraPicker`, `BuscaPrecoMLView` — reutilizar.

### C) PENDÊNCIAS (tela)
- Por item com qtd>1: **contador inline − N/alvo +** ("peguei"), na MESMA linha.
- **Concluir SÓ pelo quadradinho da esquerda** (não na linha toda — evita erro). Item concluído **SAI da lista**; rodapé "✓ N concluídas" revela/desmarca.
- Topo **"Gerenciar itens"** → menu **Adicionar / Editar / Excluir**:
  - Editar: todos abrem; toca no item → editor; "Concluir" sai.
  - Excluir: todos abrem com caixinha de seleção → marca vários → "Excluir selecionados (N)" com confirmação.
  - SEM lápis/lixeira repetido em cada item.

## REGRA DE PRODUÇÃO (CRÍTICO)
- A riqueza nova (quantidade/escopo/embalagem/conjunto/peguei/especificação extra) deve ficar em camada **LOCAL** (não sincroniza), como `evento_pendencias_extra`, pra NÃO mexer no schema de `Peca`/catálogo na nuvem.
- Estoque geral provavelmente = `Peca` com carroId nulo (vi `carroId: String?` num modelo — VERIFICAR) — menos risco.
- NADA vai pra produção sem "MIGRAR PARA PRODUÇÃO". Build/validação tudo em DEV + simulador.

## PLANO DE BUILD (estágios, cada um buildando + screenshot)
1. Estoque geral na Garagem (sub-aba) + modelo de item de estoque (escopo geral/carro, item/ferramenta, qtd, espec) — LOCAL-safe ou Peca carroId nulo (verificar).
2. Editor unificado (botões + câmera OCR reutilizando EtiquetaOCR).
3. Pendências: contador "peguei" + concluir-só-no-quadradinho + sai-da-lista + "concluídas" + menu Gerenciar (adicionar/editar/excluir).
4. Ligar Pendência ↔ estoque (puxa quantidade do estoque).
5. Build simulador + screenshots + chamar Flávio. Produção só com ordem.
