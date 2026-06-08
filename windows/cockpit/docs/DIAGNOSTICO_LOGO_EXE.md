# Diagnóstico — empacotamento do logo no .exe do cockpit Windows

> Gerado em 2026-05-10 por uma sessão do Claude Code a pedido do Flávio.
> Outra sessão pode abrir este arquivo e continuar do ponto em que está.
> Tudo o que está aqui foi verificado lendo os arquivos do repositório.
> Caminho-base: `/Users/imac/Projetos/P1 Fast/windows/cockpit/`.

---

## TL;DR

**Hoje o `.exe` do cockpit não tem logo nenhum.** Quando o Windows abrir o
binário, vai mostrar o ícone branco-genérico padrão do WinUI 3, tanto na
janela quanto na barra de tarefas, no menu Iniciar e no Alt+Tab.

Não é bug — é estado de "ainda não foi empacotado". A linha 5 do roadmap
em `windows/cockpit/README.md` confirma: **"⏳ Empacotamento .msix +
instalação no notebook"** está pendente. O projeto C# começou pelo
domínio + UI XAML; o packaging ficou pra depois.

O que falta concretamente:

1. Não há `<ApplicationIcon>` no `.csproj`.
2. Não há nenhum arquivo `.ico` na pasta `windows/`.
3. Não há pasta `Assets/` com `Square44x44Logo.png`, `Square150x150Logo.png`,
   `StoreLogo.png`, `Wide310x150Logo.png`, `SplashScreen.png`.
4. Não há `Package.appxmanifest` (o manifest MSIX que declara `<uap:VisualElements>`).
5. `<WindowsPackageType>None</WindowsPackageType>` → hoje o alvo é
   **unpackaged** (`.exe` solto), modo em que o ícone vem **só** do
   `<ApplicationIcon>`. Como esse elemento não existe, o `.exe` sai pelado.
6. `<EnableMsixTooling>true</EnableMsixTooling>` está ligado, mas sem
   `Package.appxmanifest` + `Assets/` ele não tem o que empacotar.

---

## Evidências (linha a linha do que existe hoje)

### `windows/cockpit/P1Fast.Cockpit.UI/P1Fast.Cockpit.UI.csproj`

```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net8.0-windows10.0.19041.0</TargetFramework>
    <TargetPlatformMinVersion>10.0.17763.0</TargetPlatformMinVersion>
    <RootNamespace>P1Fast.Cockpit.UI</RootNamespace>
    <AssemblyName>P1Fast.Cockpit.UI</AssemblyName>
    <ApplicationManifest>app.manifest</ApplicationManifest>
    <Platforms>x64;arm64</Platforms>
    <RuntimeIdentifiers>win-x64;win-arm64</RuntimeIdentifiers>
    <UseWinUI>true</UseWinUI>
    <EnableMsixTooling>true</EnableMsixTooling>
    <WindowsPackageType>None</WindowsPackageType>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <LangVersion>12.0</LangVersion>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.WindowsAppSDK" Version="1.6.241114003" />
    <PackageReference Include="Microsoft.Windows.SDK.BuildTools" Version="10.0.22621.756" />
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="..\P1Fast.Cockpit.Domain\P1Fast.Cockpit.Domain.csproj" />
  </ItemGroup>
</Project>
```

Pontos:
- **Não existe `<ApplicationIcon>…</ApplicationIcon>`**. Esta é a tag que
  embute o `.ico` no recurso Win32 do binário. Sem ela, o `.exe` herda o
  ícone padrão do toolchain.
- **Não existe `<ItemGroup>` com `<Content Include="Assets\…\*.png" />`**.
  Sem isso, mesmo que existissem PNGs do logo, o build não os copiaria
  pro output.

### `windows/cockpit/P1Fast.Cockpit.UI/app.manifest`

```xml
<assembly manifestVersion="1.0" xmlns="urn:schemas-microsoft-com:asm.v1">
  <assemblyIdentity version="1.0.0.0" name="P1Fast.Cockpit.UI"/>
  <application xmlns="urn:schemas-microsoft-com:asm.v3">
    <windowsSettings>
      <dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true/PM</dpiAware>
      <dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">PerMonitorV2</dpiAwareness>
    </windowsSettings>
  </application>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1">
    <application>
      <supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}"/>
    </application>
  </compatibility>
</assembly>
```

Este é o **manifest Win32** (declara DPI awareness e compatibilidade de
SO). **Não é** o manifest MSIX. Ele não carrega ícone — quem carregaria
seria o `<ApplicationIcon>` do `.csproj` ou um `Package.appxmanifest`,
nenhum dos dois existe.

### `windows/cockpit/P1Fast.Cockpit.UI/MainWindow.xaml` e `App.xaml`

A janela define o conteúdo visual interno (halo, shift light, apex, etc.)
mas **não carrega imagem de logo em lugar nenhum**. Isso é esperado — em
WinUI 3 o ícone da janela e da barra de tarefas vem do executável, não
do XAML. Posso (mas não preciso) adicionar `AppWindow.SetIcon(…)` em
`MainWindow.xaml.cs` se quiser ícone diferente do recurso embutido.

### Listagem da pasta `windows/cockpit/P1Fast.Cockpit.UI/`

```
app.manifest
App.xaml
App.xaml.cs
MainWindow.xaml
MainWindow.xaml.cs
P1Fast.Cockpit.UI.csproj
```

Confirmado: **sem pasta `Assets/`, sem `.ico`, sem `Package.appxmanifest`**.

### Roadmap em `windows/cockpit/README.md` (linha 37)

> 5. ⏳ Empacotamento `.msix` + instalação no notebook

Ou seja, packaging continua aberto. A intenção do plano é distribuir
como MSIX, mas o csproj atual está como `WindowsPackageType=None`
(unpackaged), o que sugere que alguém vai precisar mudar pra MSIX
quando for empacotar — ou aceitar o `.exe` solto e só adicionar
`<ApplicationIcon>`.

---

## Onde está a fonte do logo

A fonte canônica de alta resolução está no projeto iOS:

```
ios/p1fast-ios/Resources/Assets.xcassets/AppIcon.appiconset/icon-1024.png
```

Esse PNG 1024×1024 é o que vira AppIcon do app iOS. Pode ser usado
como base para gerar:

- `P1Fast.ico` multi-resolution (16, 24, 32, 48, 64, 128, 256 px) pro
  `<ApplicationIcon>` do `.csproj`.
- Os 5 PNGs que o MSIX espera, se for por esse caminho:
  - `Assets/Square44x44Logo.png` (e `.targetsize-{16,24,30,36,44,48,256,…}_altform-unplated.png`)
  - `Assets/Square150x150Logo.png`
  - `Assets/StoreLogo.png` (50×50)
  - `Assets/Wide310x150Logo.png`
  - `Assets/SplashScreen.png` (620×300)

Alternativa: existe `_design-reference/decisoes-cockpit.html` e diversos
mockups. Não há `.svg`/`.png` específico de "logo P1 Fast" fora do
AppIcon iOS — quem precisar de marca vetorial vai precisar pedir pro
Flávio o source ou pegar o icon-1024 e tratar.

---

## Dois caminhos possíveis (decisão é do Flávio)

### Caminho A — `.exe` unpackaged com ícone embutido (mínimo viável)

Mantém `WindowsPackageType=None`. Ganha o ícone no binário, sem MSIX.
É o que basta pra **rodar no notebook do carro** clicando no `.exe`.

Mudanças necessárias:

1. Gerar `windows/cockpit/P1Fast.Cockpit.UI/Assets/P1Fast.ico` a partir
   de `ios/p1fast-ios/Resources/Assets.xcassets/AppIcon.appiconset/icon-1024.png`.
2. No `.csproj`, adicionar dentro do `<PropertyGroup>` principal:
   ```xml
   <ApplicationIcon>Assets\P1Fast.ico</ApplicationIcon>
   ```
3. (Opcional) No `MainWindow.xaml.cs` chamar
   `AppWindow.SetIcon("Assets/P1Fast.ico")` pra garantir o ícone na
   barra de título da janela ativa também — em alguns cenários WinUI 3
   unpackaged não pega automaticamente do recurso embutido.

Custo: ~30 min. Não muda a topologia do projeto.

### Caminho B — Empacotamento MSIX completo (item 5 do roadmap)

Distribuição "instalável" em vez de `.exe` solto. Aparece no menu
Iniciar com nome e ícone certos, recebe atualizações, assina com
certificado.

Mudanças necessárias:

1. Gerar pasta `Assets/` com os 5 PNGs (Square44x44, Square150x150,
   StoreLogo, Wide310x150, SplashScreen) — recomendo usar a ferramenta
   "Image Tooling" do Visual Studio ou um script com ImageMagick a
   partir do `icon-1024.png`.
2. Adicionar `Package.appxmanifest` em
   `windows/cockpit/P1Fast.Cockpit.UI/` declarando `Identity`, `Logo`,
   `<uap:VisualElements>` apontando pros PNGs, e capabilities mínimas.
3. Trocar `<WindowsPackageType>None</WindowsPackageType>` por
   `<WindowsPackageType>MSIX</WindowsPackageType>`.
4. Adicionar no `.csproj` os PNGs como conteúdo:
   ```xml
   <ItemGroup>
     <Content Include="Assets\*.png" />
     <Content Include="Package.appxmanifest" />
   </ItemGroup>
   ```
5. Configurar certificado de assinatura (self-signed pra testes;
   certificado real só quando for distribuir além do notebook do Flávio).
6. Configurar GitHub Actions pra `dotnet publish -c Release` gerar
   `.msix` como artifact (alinhar com item 2 do roadmap, que é "rodar
   checks no GitHub").

Custo: ~½ dia, dependendo de assinatura. **Trava em produção**: sim,
porque virar MSIX redefine como o cockpit é instalado no notebook do
carro — Flávio precisa autorizar com `MIGRAR PARA PRODUÇÃO:` antes de
mexer nesse fluxo se ele já estiver em uso.

---

## O que está bloqueando agora

**Nada técnico.** Os dois caminhos são executáveis. O bloqueio é
decisão do Flávio:

- Ele quer **só ícone no `.exe` solto** (Caminho A, mínimo viável)?
- Ou quer **partir direto pra empacotamento MSIX** (Caminho B, item 5
  do roadmap)?

A próxima sessão Claude Code que pegar este diagnóstico precisa
**perguntar ao Flávio qual caminho** antes de tocar nos arquivos.

---

## Arquivos-chave pra próxima sessão abrir

- `/Users/imac/Projetos/P1 Fast/windows/cockpit/P1Fast.Cockpit.UI/P1Fast.Cockpit.UI.csproj`
- `/Users/imac/Projetos/P1 Fast/windows/cockpit/P1Fast.Cockpit.UI/app.manifest`
- `/Users/imac/Projetos/P1 Fast/windows/cockpit/README.md` (roadmap)
- `/Users/imac/Projetos/P1 Fast/ios/p1fast-ios/Resources/Assets.xcassets/AppIcon.appiconset/icon-1024.png` (fonte do logo)
- `/Users/imac/Projetos/P1 Fast/ARCHITECTURE_DECISIONS.md` (ADR-023 — contexto do cockpit Windows)

## Comandos úteis pra próxima sessão

```bash
# Ver todos os arquivos da UI WinUI
ls "/Users/imac/Projetos/P1 Fast/windows/cockpit/P1Fast.Cockpit.UI/"

# Confirmar que ainda não tem .ico, Assets/ ou appxmanifest
find "/Users/imac/Projetos/P1 Fast/windows" -type f \
  \( -name "*.ico" -o -name "Package.appxmanifest" \) 2>/dev/null

# Conferir o csproj antes de editar
grep -E "ApplicationIcon|WindowsPackageType|EnableMsixTooling" \
  "/Users/imac/Projetos/P1 Fast/windows/cockpit/P1Fast.Cockpit.UI/P1Fast.Cockpit.UI.csproj"
```

---

## Status do diagnóstico

**Concluído.** Pronto pra ser consumido por outra sessão Claude Code
sem necessidade de re-investigar o estado atual do empacotamento.

Última verificação em: 2026-05-10.
