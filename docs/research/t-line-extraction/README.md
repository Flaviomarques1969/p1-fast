# Extração do software T LINE (Injepro)

130 arquivos `t8000.*` extraídos do software oficial da Injepro **T LINE v3.3.7** durante sessão automática 2026-05-26 madrugada.

## O que é

São recursos (`.resources`) extraídos do binário do software oficial da Injepro que serve a família T-Series inteira (T3000, T4000, T5000, T8000, T10000). Apesar do nome "t8000", servem todos.

- `t8000.g.resources` (42 MB) — recursos gráficos compilados
- `t8000.Resources.Strings.*.resources` — textos em PT-BR organizados por tela do software

## Por que existem aqui

Matéria-prima da engenharia reversa que decodificou 30+ sensores da T3000 plugada no Bubi. Sem esse mapeamento, o painel mostrava só 4 sensores (RPM, bateria, injeção, lambda). Hoje mostra: pedais, freio, acelerômetro, temperaturas, mapas, alarmes, etc.

Resultado da decodificação está em `web/cockpit/t3000-usb-parser.js` (incorporado pela submissão #214 em 2026-05-26).

## Origem

Sessão automática que rodou enquanto o Flávio dormia. Histórico nas memórias `p1-fast-injepro-protocolo-2026-05-25` e nos commits `61ad2fff` (#213) e `817e3748` (#214).

## Não apagar sem autorização

Pode parecer entulho, mas é a fonte da verdade. Se a Injepro mudar o software, podemos precisar re-extrair pra validar. Movidos pra cá em 2026-05-26 pra desbagunçar a raiz do projeto.
