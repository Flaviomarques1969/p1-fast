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

## DECISÃO PENDENTE antes de construir
- Quantidade é **fixa do item** (cadastra 1x, vale sempre) ou **por evento** (ajusta a cada track day)? `pegou` é sempre por evento.

## CUIDADO de produção (ler antes de construir)
- A riqueza nova (quantidade/spec/embalagem/conjunto/pegou) deve ficar em camada **LOCAL** (não sincronizar), igual `evento_pendencias_extra`, pra NÃO mexer no schema do catálogo na nuvem (produção). Catálogo dá só os nomes-base; o resto é local por evento.
- Só portar pro app oficial/produção com "MIGRAR PARA PRODUÇÃO".
