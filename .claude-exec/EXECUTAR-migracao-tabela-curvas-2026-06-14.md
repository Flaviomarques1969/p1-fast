# ROTEIRO DE EXECUÇÃO — criar a tabela tipos_curva_vivos em produção (14/06/2026)

> Ao retomar (`/voltei classificador-curvas`): este é o passo a passo EXATO, já aprovado pelo conselho
> e VERIFICADO. Contexto completo: `.claude-exec/PROBLEMA-migracao-tabela-curvas-2026-06-14.md`.
> AUTORIZAÇÃO DO FLÁVIO: já dada ("migrar para produção" + "agora pode ir para a produção" + pediu pra
> eu deixar o comando pronto e executar após o clear). => Ao retomar, EXECUTAR os passos abaixo e reportar.
> NÃO re-perguntar autorização; só executar com cuidado e reportar com prova.

## MÉTODO (verificado por --help nesta sessão)
`supabase db query --linked` roda SQL avulso contra o banco de produção via Management API usando o
token que a CLI já tem logado. NÃO usa a senha do Postgres. NÃO toca na fila de migrações (logo, é
IMPOSSÍVEL disparar a mina 0028_rollback_brasilia_seed por aqui). Flags confirmadas: `--linked`,
`--file/-f <arquivo>`, `--output table`.

## REGRA DE OURO
NUNCA rodar `supabase db push` nem `--include-all` neste repo: a 0028_rollback_brasilia_seed.sql está
pendente e faz `DELETE FROM track_segments` + `DELETE FROM track_layouts` do layout de Brasília
(0dc85cfb-6236-567e-814c-eddf610b301f) — apagaria as 8 curvas e o traçado. NÃO mexer no ledger agora.

## PASSO A PASSO (rodar a partir de /Users/imac/Projetos/P1 Fast)
PSQLFONTE="/Users/imac/Projetos/p1fast-worktrees/classificador-trail/supabase/migrations/0043_tipos_curva_vivos.sql"

1. Copiar a 0043 pra /tmp (evita virar migração pendente no repo principal linkado):
   `cp "$PSQLFONTE" /tmp/0043_tipos_curva_vivos.sql`

2. GUARDA (antes): confirmar que as 8 curvas estão lá (tem que dar 8):
   `supabase db query --linked "select count(*) as curvas from public.track_segments where layout_id='0dc85cfb-6236-567e-814c-eddf610b301f';"`

3. CRIAR a tabela (arquivo é transacional BEGIN/COMMIT — tudo ou nada):
   `supabase db query --linked --file /tmp/0043_tipos_curva_vivos.sql`

4. VERIFICAR a tabela nova (tem que dar 8 linhas com o padrão):
   `supabase db query --linked "select nome, tipo_aprovado, origem from public.tipos_curva_vivos order by nome;"`
   Esperado: Curva 01=T5, Reta Oposta=T1, Curva 2=T0, Junção=T2, Bruxa=T0, Placar=T2, S=T4, Vitória=SF.

5. GUARDA (depois): confirmar que as 8 curvas continuam intactas (tem que dar 8 de novo):
   `supabase db query --linked "select count(*) as curvas from public.track_segments where layout_id='0dc85cfb-6236-567e-814c-eddf610b301f';"`

6. Se tudo ok: reportar ao Flávio (tabela criada, 8 linhas, 8 curvas intactas) e atualizar:
   - memória p1-fast-classificador-vivo-command-box-trechos-2026-06-13 (tabela em produção)
   - registrar em ~/.claude-decisoes (migração aplicada)
   - marcar no CONTINUAR que a tabela foi pra produção.

## ROLLBACK (se precisar desfazer — seguro, a tabela é isolada)
`supabase db query --linked "drop table if exists public.tipos_curva_vivos;"`

## SE FALHAR / DÚVIDA
- Plano B (Flávio executa): entregar o SQL pronto (copiar de $PSQLFONTE) pra ele colar no SQL Editor do
  Supabase e clicar Run. Mesma segurança.
- Se a tabela já existir com schema diferente: NÃO re-rodar cego (o CREATE IF NOT EXISTS não atualiza
  colunas). Avaliar drop + recria. Hoje a tabela NÃO existe (verificado).

## FATOS (verificados, não reinventar)
- Projeto: p1-fast ref fvhwltzhytpnhlqbttmd. Layout Brasília: 0dc85cfb-6236-567e-814c-eddf610b301f.
- Tabela alvo NÃO existe ainda. 8 curvas intactas. 8 segment_ids da 0043 batem com track_segments.
- supabase CLI v2.101 autenticada/linkada (link no repo principal). `db query` confirmado por --help.
- 0043 (idempotente): CREATE TABLE IF NOT EXISTS + 3 policies drop-if-exists/create + INSERT ON CONFLICT
  DO NOTHING. Zero DELETE/DROP/ALTER em tabela existente.
