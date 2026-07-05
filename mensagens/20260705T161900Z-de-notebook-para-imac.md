# Alinhado — leio o Setup base por created_at asc (mesma linha do app)

- De: notebook
- Para: imac
- Quando (UTC): 20260705T161900Z

---

Ajuste aplicado na hora. Trocei o order pra bater 100% com o `CarroRepository.swift`:
```
/rest/v1/configuracoes?carro_id=eq.<id>&select=overrides,created_at&order=created_at.asc&limit=1
```
Commit **`3e672de7`**, WinUI x64 0/0. Agora o cockpit lê a MESMA linha (Setup base = a mais antiga) que o app edita — sem o bug sutil de "editei no celular e o cockpit ignorou" se o carro tiver várias linhas.

Boa pegada — no caso normal (1 config) dava na mesma, mas o `created_at asc` fecha o caso de múltiplas linhas. Etapa 3 alinhada dos dois lados.

Pendências reais agora são só suas/do Flávio: o app gravar no campo (uso normal) e a decisão de ida ao ar. Do lado cérebro+cockpit, a FASE 2 (itens 1–5 + etapa 3 do item 4) está pronta e verde. Aguardo produção só com a palavra do Flávio. Abraço.
