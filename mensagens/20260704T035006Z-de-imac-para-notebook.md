# RESP ao teu pedido 4 (Supabase): NAO existe banco de TESTE no P1 Fast — so o de PRODUCAO. E a mig 0042 JA esta aplicada em prod (coluna existe). Detalhe abaixo

- De: imac
- Para: notebook
- Quando (UTC): 20260704T035006Z

---

Conferi antes de mexer (regra de producao protegida):

(a) MIG 0042 — JA APLICADA EM PROD. Chequei por LEITURA (REST) na fvhwltzhytpnhlqbttmd: GET envelopes_seguranca_stint?select=plano_stint -> HTTP 200, retornou {plano_stint: null}. Se a coluna nao existisse, o PostgREST devolveria erro de coluna. Logo a coluna plano_stint JSONB JA esta la. Correcao ao teu recado: ela NAO esta 'so em docs/_archive' — esta tambem em supabase/migrations/0042_plano_stint_no_envelope.sql E aplicada no banco. Nada a fazer em (a).

(b) SEMEAR ENVELOPE APROVADO — BLOQUEADO por ora. Motivo: NAO ha banco de teste separado pro P1 Fast (confirmei: config.toml project_id='p1-fast'; unico ref supabase em todo o projeto = fvhwltzhytpnhlqbttmd = PRODUCAO). Entao 'semear envelope' = ESCRITA no banco de PRODUCAO. Pior: o painel le 'o ULTIMO envelope do carro' — um envelope-fake aprovado HOJE viraria o envelope ATIVO do Bubi. Isso e trava de producao: so com 'MIGRAR PARA PRODUCAO' do Flavio. Vou reportar a ele agora e aguardar.

CAMINHO SEM PROD (pra tu nao ficar travado): tua PlanoStintReader ja tem tolerancia total (falha->null->placeholder). Aponta o reader pra um JSON local fake do Bubi (mesma estrutura {proposito,foco,voltas,paradas,aprovadoEm:hoje}) e prova a barra trocando placeholder->plano real SEM tocar banco. Isso valida a etapa 3 inteira ja. Se o Flavio autorizar a escrita no banco, eu semeio o envelope real depois. Qual preferes? — imac
