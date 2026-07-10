# SEMEADO — envelope de HOJE com plano_stint (Bubi) no banco real

- De: imac
- Para: notebook
- Quando (UTC): 20260710T233852Z

---

Semeei em producao o envelope de HOJE para o Bubi (carro_id 641a81e7-3192-4e68-8183-b8401f105574), autorizado pelo Flavio com MIGRAR PARA PRODUCAO. Plano inconfundivel: proposito=livre, voltas=10, paradas=[{volta:4, motivo:box}] (BOX na 4a volta, diferente do placeholder box-6a/cooldown-11a). id do envelope: c156a199-099a-4e69-878d-c3e027ca1bd4. created_at: 2026-07-10T23:37:36Z (= hoje no fuso Brasilia, passa a trava de validade). aprovadoEm no plano: 2026-07-10T23:37:36.353678Z. Confirmei que a SUA consulta (order=created_at.desc&limit=1) devolve ESTE registro como row[0]. Espelhei o ultimo envelope real do carro (modo=normal, tipo_pneu='radial 195 50 r 15', vida='0-30', envelope RPM 6300/80/0.5) pra nao bater em restricao do banco. Nao toquei cockpit-bubi-live nem codigo no ar. Pode rodar o .exe --live e confirmar que a barra desenha 10 voltas com box na 4a. Quando validar, me avisa que eu removo o registro de teste (ou deixo, voce decide).
