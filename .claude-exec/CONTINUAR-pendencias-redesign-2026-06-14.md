# CONTINUAR — Pendências redesenhada (aprovada 2026-06-14)

Flávio aprovou ("perfeito") o desenho novo das Pendências.
Mockup canônico aprovado: `_design-reference/mockup-pendencias-APROVADO-2026-06-14.html`
(igual ao `mockup-menu-reorg.html` no momento da aprovação).

## O que JÁ está no app (DEV, feito antes nesta sessão)
- Menu: Home · Eventos · **Pendências** · Garagem (Garagem com sub-abas).
- Pendências abre no PRÓXIMO evento; 6 grupos reais (45 itens).
- Incluir/excluir item adicional LOCAL-ONLY (`evento_pendencias_extra`, não sincroniza).
- Cor por categoria: obrigatório avermelhado, desejável amarelo.
- Ticar afunda; grupos colapsáveis (sanfona, linha inteira do cabeçalho clica).

## O que o MOCKUP APROVADO acrescenta (FALTA portar pro app)
1. **Quantidade por item** com dois botões **− / +** inline ("peguei N / alvo").
2. **Tipos de quantidade no cadastro**: Simples (Jacks ×4), **Embalagens** (4 × 1 L de óleo, com especificação ex "Mobil 5W30"), **Conjunto** (rodas Aro 15 + Aro 14).
3. **Especificação** (qual/tipo) por item.
4. Botão topo **"Gerenciar itens"** → menu **Adicionar / Editar / Excluir**:
   - Editar: todos abrem, toca no item → editor. "Concluir" sai.
   - Excluir: todos abrem com caixinha de seleção → marca vários → "Excluir selecionados (N)" com confirmação.
   - Tirou o lápis/lixeira de cada linha (não repete em todo item).
5. **Câmera no editor**: "Tirar foto e ler o item" (OCR do rótulo preenche sozinho). App já tem OCR: `EtiquetaOCR.swift`, `BarcodeScannerView`, `CameraPicker` — reutilizar.
6. **Concluir item só pelo quadradinho da esquerda** (NÃO clicar na linha toda — evita erro). Item concluído SAI da lista; rodapé "✓ N concluídas" revela/desmarca.

## MODELO DE ESTOQUE (confirmado por Flávio 2026-06-14) — resolve a quantidade
- **Garagem = Carros + Estoque geral.**
- **Estoque do carro** (JÁ EXISTE no app: CarroHubView → "Estoque do carro" → PecaListaView/PecaRepository; `Peca` tem carroId, nome, especificacao, quantidade, area, tipo): itens específicos daquele carro (ex: óleo daquele carro).
- **Estoque geral** (NOVO): itens e **ferramentas** que não são de um carro específico. Provável: `Peca` com carroId nulo (verificar — vi `carroId: String?` num modelo) OU escopo "geral".
- **Item unificado, cadastrável de 3 lugares (circular):** dentro de um carro, no estoque geral, ou direto na Pendência. No cadastro escolhe **escopo** = Estoque geral OU Estoque do carro X, + quantidades. A partir daí administra.
- **Quantidade mora no ESTOQUE** (geral ou do carro). Pendência do evento PUXA disso (o que levar) e você marca "peguei". Resolve a dúvida fixa-vs-por-evento: a posse é no estoque; o "peguei" é por evento.
- Campo novo no cadastro: **Item ou Ferramenta** (estoque geral pode ter os dois).

## CUIDADO extra
- `Peca` (estoque do carro) SINCRONIZA com a nuvem (produção). Mexer no schema de Peca = produção. Estoque geral pode ser Peca com carroId nulo (menos risco) — verificar antes.

## CUIDADO de produção (ler antes de construir)
- A riqueza nova (quantidade/spec/embalagem/conjunto/pegou) deve ficar em camada **LOCAL** (não sincronizar), igual `evento_pendencias_extra`, pra NÃO mexer no schema do catálogo na nuvem (produção). Catálogo dá só os nomes-base; o resto é local por evento.
- Só portar pro app oficial/produção com "MIGRAR PARA PRODUÇÃO".
