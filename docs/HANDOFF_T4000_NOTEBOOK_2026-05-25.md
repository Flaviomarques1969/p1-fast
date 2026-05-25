# Continuidade — ligar a T4000 no notebook (handoff pro celular)

> **Pra mim, Claude, em qualquer canal (celular Claude Code, iMac, novo /clear):**
> Este documento existe pra continuar UMA tarefa específica: fazer o software
> do P1 Fast efetivamente ler a Injepro T4000 quando o Flávio plugar o
> notebook Samsung Windows no carro. Leia este documento PRIMEIRO. Depois
> `STATUS.md`. Depois execute. Não pergunte ao Flávio coisa que está aqui.

## Contexto que já está fechado (não reabrir)

- **Notebook**: Samsung com Windows. Já é do Flávio. Confirmado em `docs/audit-2026-05-10/respostas-flavio.json` linha "sync".
- **Carro**: Celta "Bubi", motor Onix 1.4 preparado, central Injepro T4000 com USB traseiro nativo + saída CAN 1 Mbit/s + Bluetooth.
- **Plataforma do painel do piloto na pista**: Windows nativo, .NET 8 + WinUI 3 (ADR-023 amendments 4 e 5). Decidido. Não reabrir.
- **Estado do "cérebro"** (`windows/cockpit/P1Fast.Cockpit.Domain/`): pronto, 129 testes automáticos verdes em sistema de checagem contínua (GitHub Actions). Parser dos 5 pacotes, validação de soma de verificação, simulador, leitor com porta abstrata, ponte com painel, alertas críticos.
- **Programa de captura crua** (`windows/cockpit/P1Fast.Cockpit.T4000Capture/`): pronto. Abre porta USB real do notebook, detecta porta sozinho, lê bytes da T4000 e salva em arquivo `.bin` + índice de tempo. SÓ grava bytes, não interpreta.
- **Demonstração com painel ao vivo** (`windows/cockpit/P1Fast.Cockpit.T4000LiveDemo/`): pronto. Roda no notebook com simulador no lugar da T4000, mostra painel de console reagindo a cenários. Útil pra ver visualmente sem hardware.

## O gap real que falta executar

**Existe exatamente UMA peça faltando** entre o que está pronto e "ligar o notebook no carro e ver o painel reagindo aos dados da T4000 real":

Um adaptador (peça de ligação) em C# que pluga a porta serial real do Windows (`System.IO.Ports.SerialPort`) na interface abstrata `ISerialBytePort` que o leitor do cérebro espera. Hoje só existe a implementação de mentira (`InMemorySerialBytePort`, usada nos testes automáticos).

**Onde colocar**: novo arquivo `windows/cockpit/P1Fast.Cockpit.T4000LiveDemo/SystemIoPortsSerialBytePort.cs` (ou projeto novo `P1Fast.Cockpit.Hardware/` se ficar mais limpo).

**O que o adaptador faz** (50 linhas mais ou menos):

```csharp
public sealed class SystemIoPortsSerialBytePort : ISerialBytePort, IDisposable
{
    private readonly SerialPort _sp;
    public SystemIoPortsSerialBytePort(string portName)
    {
        _sp = new SerialPort(portName) {
            BaudRate = 1_000_000, DataBits = 8, Parity = Parity.None,
            StopBits = StopBits.One, ReadTimeout = 200, WriteTimeout = 1000,
        };
        _sp.Open();
    }
    public ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken ct)
    {
        // System.IO.Ports.SerialPort.BaseStream.ReadAsync respeita ct
        return _sp.BaseStream.ReadAsync(buffer, ct);
    }
    public void Close() => _sp.Close();
    public void Dispose() => _sp.Dispose();
}
```

Referência: copiar a abertura da porta + tratamento de erro do `P1Fast.Cockpit.T4000Capture/Program.cs` linhas 62-85 (já testada em campo pela própria ferramenta de captura crua).

**Depois disso, plugar no demo**: adicionar flag `--real --port=COMx` no `T4000LiveDemo/Program.cs` que troca `InMemorySerialBytePort` por `SystemIoPortsSerialBytePort(portName)` e NÃO roda o simulador. Tudo o mais (leitor, provider, ponte, painel) já funciona — é só trocar a porta.

**Empacotamento (criar instalador)**: o sistema de checagem contínua já tem job `t4000-live-demo-publish` (em `.github/workflows/windows-cockpit.yml`) que gera um único arquivo `.exe` Windows 64-bit autocontido (não precisa instalar .NET no notebook). Cada alteração nova gera esse arquivo automaticamente — fica disponível pra baixar por 14 dias.

## Plano de execução (≤ 5 passos)

1. **Criar ambiente isolado de trabalho** (worktree) a partir da versão oficial atual: `git worktree add -b feat/t4000-serial-real /tmp/p1fast-t4000-real origin/main`.
2. **Escrever o adaptador** `SystemIoPortsSerialBytePort.cs` no projeto `T4000LiveDemo`. Adicionar 2-3 testes automáticos simples (abrir porta inexistente → erro humano; abrir porta válida → não trava).
3. **Plugar no demo**: adicionar flag `--real --port=COMx` no `T4000LiveDemo/Program.cs`. Modo simulador continua existindo (default).
4. **Rodar os 129 testes automáticos** localmente via Docker .NET 8 pra garantir que nada quebrou: `docker run --rm -v $PWD:/src -w /src mcr.microsoft.com/dotnet/sdk:8.0 dotnet test windows/cockpit/P1Fast.Cockpit.sln`.
5. **Registrar e enviar pra versão oficial** (commit + push). Submeter pra aprovação formal (PR no GitHub). Após aprovação, sistema de checagem contínua gera o `.exe` final que o Flávio baixa no notebook.

## Como o Flávio testa quando o ambiente isolado virar versão oficial

1. Baixa o arquivo `p1fast-t4000-live-demo.exe` do GitHub Actions (último job verde, artifact "t4000-live-demo-publish-win-x64"). Coloca em qualquer pasta do notebook.
2. Liga o carro com chave em ON (não só Acessórios — a Injepro precisa de alimentação plena).
3. Pluga cabo USB da traseira da T4000 numa porta USB do notebook.
4. Abre Prompt de Comando, vai na pasta do `.exe`, digita: `p1fast-t4000-live-demo.exe --real`. O programa detecta a porta sozinho. Se quiser forçar: `--real --port=COM3`.
5. Painel de console começa a reagir. Tira foto da tela e manda no WhatsApp pra documentar o primeiro teste fim-a-fim.

Se aparecer "Nenhuma porta serial encontrada" → driver USB da Injepro não instalou. Solução: instalar o "Injepro T Software" primeiro (driver vem junto) e fechar antes de rodar nosso programa (senão a porta fica ocupada).

Se aparecer bytes mas zero sentinelas → a USB traseira da T4000 fala um formato diferente do CAN documentado. Nesse caso, é necessário um adaptador USB-CAN externo plugado no chicote CAN da Injepro. Cabo: ~R$ 150-300, modelo CANable v2.0 ou equivalente. Esse passo entra como passo 6 (não bloqueia o adaptador C# atual — só posterga a validação).

## Estado do registro de tarefa do projeto

- Documento `.claude-exec/ultima-tarefa.md` da sessão atual (2026-05-25) iniciado no iMac, ainda em estado "iniciado" — NÃO foi enviado pra versão oficial porque o iMac tem alterações de tarefas antigas misturadas. Este documento aqui (`HANDOFF_T4000_NOTEBOOK_2026-05-25.md`) é o registro oficial pra continuar no celular.

## Prompt pra colar no Claude Code do celular

Quando o Flávio abrir o Claude Code no celular, na pasta do projeto P1 Fast (precisa estar atualizada via `git pull origin main` se estiver desatualizada), basta colar isto:

```
Vou continuar a tarefa de ligar a T4000 no notebook. Lê docs/HANDOFF_T4000_NOTEBOOK_2026-05-25.md primeiro, depois executa os 5 passos do plano. Sem perguntar. Quando o ambiente isolado estiver pronto e os 129 testes automáticos passarem, me avisa que eu autorizo enviar pra versão oficial.
```

Quando o Flávio responder "manda" / "envia" / "vai pra versão oficial": registra + envia + abre submissão pra aprovação formal (PR) com auto-merge se possível, conforme regra contínua de aprovação de submissões auditadas do P1 Fast (memória `feedback_deploy_rules`).

## Quando esta tarefa estiver concluída

- Atualizar `STATUS.md` marcando MS-9.3 como completamente fechada (não mais "Falta só a implementação real").
- Atualizar este documento com a data e o resultado fim-a-fim no carro.
- Quando Flávio mandar a foto do painel no notebook com a T4000 real, salvar no projeto em `docs/hardware/fotos-t4000-notebook/` (criar pasta) pra ficar registrado.
