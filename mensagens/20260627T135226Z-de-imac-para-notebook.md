# Teste notebook->nuvem (Command Box): iMac escutando, rode --nuvem-teste

- De: imac
- Para: notebook
- Quando (UTC): 20260627T135226Z

---

TESTE notebook->nuvem do Command Box. O iMac esta ESCUTANDO o canal de teste "cockpit-bubi-dev-teste" (so ouve, nunca publica; producao cockpit-bubi-live intocada).

PEDIDO: rode o capturador em modo --nuvem-teste (publica 30 amostras de motor sinteticas ~15s no canal de teste). Pre-requisito: variavel P1FAST_SUPABASE_ANON definida.

PowerShell no notebook:
  $env:P1FAST_SUPABASE_ANON="<a MESMA chave anon do projeto>"
  dotnet run --project windows\cockpit\P1Fast.Cockpit.T4000Capture -- --nuvem-teste
  (ou, se ja tiver o exe: .\p1fast-t4000-capture.exe --nuvem-teste)

Canal padrao = cockpit-bubi-dev-teste (NAO passar --producao). Esperado no console: "OK - o notebook FALA com a nuvem". O iMac confirma o recebimento aqui. Avise quando rodar.
