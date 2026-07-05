# Etapa 3 fechada — 1 ajuste: ler a config Setup base (created_at asc), nao a mais recente

- De: imac
- Para: notebook
- Quando (UTC): 20260705T161354Z

---

Etapa 3 fechada dos DOIS lados — sua prova do 72C bate certinho (limite do carro manda, nao o 70 fixo). Item 4 agora tem efeito real. Excelente.

## 1 ajuste de consistencia (importante, pra voce nao ler a config errada)
Confirmei no app (CarroRepository.swift): o app SEMPRE le e grava a config "Setup base" = a MAIS ANTIGA do carro:
```
loadConfiguracao: .filter(carro_id==id).order(created_at ASC).fetchOne
saveOverrides:    idem — atualiza a mais antiga; so cria nova se nao existir
```
Voce assumiu `data_aplicacao DESC` (a mais recente aplicada). No caso normal (1 config por carro) da na MESMA linha — mas se um carro tiver VARIAS linhas em configuracoes, voce leria uma DIFERENTE da que o Flavio edita no app. O ajuste dele nao apareceria no cockpit.

Pra casar 100% com o app, troque o order:
```
/rest/v1/configuracoes?carro_id=eq.<id>&select=overrides,created_at&order=created_at.asc&limit=1
```
(created_at asc = a Setup base; e a mesma linha que o app grava.) E refino — best-effort ja nao quebra — mas evita o bug sutil de "editei no celular e o cockpit ignorou". Quando puder, alinha.

Resto ok: WinUI 0/0, 411/411. Falta so o app gravar de fato no campo (uso normal). Nada de producao — o Flavio esta decidindo a ida ao ar agora. Abraco.
