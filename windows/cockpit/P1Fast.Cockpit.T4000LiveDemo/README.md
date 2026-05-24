# p1fast-t4000-live-demo

Demonstração fim-a-fim do pipeline T4000 **sem precisar de carro nem central
Injepro real**. Útil pra:

- Validar visualmente o painel reagindo a dados típicos antes do primeiro
  track day.
- Conferir que toda a cadeia (simulador → porta → leitor → provider →
  bridge → painel + publicação ao vivo) funciona junta.
- Demonstrar o produto pra terceiros sem montar o carro.

## Como rodar

No notebook Windows com .NET 8:

```
dotnet run --project windows/cockpit/P1Fast.Cockpit.T4000LiveDemo
```

Quando o empacotamento single-file estiver pronto, vai virar:

```
p1fast-t4000-live-demo.exe
```

## O que sai no console

```
=== P1 Fast — Demonstração T4000 (sem carro) ===
...
[cenário] Idle
[painel] shift=off
[health] bytes=  4 000 pacotes=  500 realtime publicado=    9 descartado=   11 último canal=live-stint-demo

[cenário] Cruise
[painel] shift=lit(1)
[health] ...

[cenário] Redline
[painel] shift=fire
[health] ...

[cenário] OverheatWater
[painel] ALERTA grave: Temperatura água crítica
[health] ...
```

## Como parar

Q, Esc, ou Ctrl+C.
