# P1 Fast — Cockpit Windows nativo

> Pasta criada em 2026-05-09 conforme **ADR-023 amendment 4** (decisão Flávio).
>
> Esta é a versão final do cockpit do piloto que vai rodar no notebook
> 10,5" no painel do carro. Linguagem: **C# (.NET 8) + WinUI 3**.
>
> O protótipo HTML em `web/cockpit/` continua existindo como referência
> visual e como spec dos checks (cada check JS tem equivalente C# aqui).

## Como está organizado

| Pasta | O que tem dentro |
|---|---|
| `P1Fast.Cockpit.Domain/` | **O cérebro do cockpit** — toda a lógica que decide "qual cor o halo deve estar", "quantos LEDs do shift acender", "qual mensagem de alerta mostrar". Não desenha nada na tela. Pode rodar em qualquer computador (Windows, Mac, Linux) pra rodar checks. |
| `P1Fast.Cockpit.Domain.Tests/` | Os checks que provam que o cérebro funciona. Cada regra do cockpit tem um check; cada vez que mudo o cérebro, os checks rodam automaticamente no GitHub e me avisam se quebrei algo. |
| `P1Fast.Cockpit.WinUI/` | **A tela do cockpit** — a parte que desenha shift light, halo, apex, etc. Só existe pra Windows. (Será criada depois que o cérebro estiver 100% pronto.) |

## Como o desenvolvimento acontece

1. Eu escrevo o código aqui no projeto.
2. Salvo com `git push`.
3. O GitHub roda os checks automaticamente num computador deles ("CI").
4. Se algo quebrar, o GitHub me avisa e eu conserto.
5. Quando todo um pedaço grande estiver pronto, gero um instalador Windows (arquivo `.msix`) que você baixa e clica pra instalar no notebook.

**Você não precisa abrir Visual Studio, não precisa compilar nada, não precisa rodar testes.** Tudo isso roda no GitHub e você só vê os resultados — verde (passou) ou vermelho (não passou).

## Status atual

Em construção. Próximos passos seguem a ordem da ADR-023 amendment 4:

1. ⏳ Portar lógica pura JS → C# (5 módulos: CockpitState, T4000PacketParser, TransportSelector, LiveDataBridge, T4000Provider)
2. ⏳ Configurar GitHub Actions pra rodar checks automaticamente
3. ⏳ Implementar a tela XAML 1:1 com o mockup canônico
4. ⏳ Driver do T4000 (USB) + cliente do cabo iPhone
5. ⏳ Empacotamento `.msix` + instalação no notebook
