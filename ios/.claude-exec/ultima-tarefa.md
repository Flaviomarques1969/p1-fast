# Última tarefa — Tela de TESTE AO VIVO (viewer Daily.co)

## Pedido original
Adicionar UMA tela de teste no app iOS P1 Fast (viewer Daily.co com vídeo
remoto + overlay GPS), com botão "TESTE AO VIVO" na Home + launch arg
`--p1-teste-aovivo`, e instalar no iPhone físico do Flávio. Não apagar nada.

## Objetivo
Tela que conecta como viewer numa sala Daily.co, mostra o vídeo do notebook
em tela cheia e o GPS por app-message, instalada no iPhone 16 Pro Max.

## Critério de conclusão
App compila para o device, instala (mesmo bundle id = atualização) e tem
botão visível na Home pra abrir a tela.

## Plano executado
1. Inspecionar ContentView/HomeView + swiftinterface do Daily. OK
2. Criar TesteAoVivoView.swift. OK
3. Wire: rota + launch arg + botão Home. OK
4. project.yml: NSMicrophoneUsageDescription + NSLocalNetworkUsageDescription
   (NSCameraUsageDescription já existia). xcodegen regen. OK
5. Build device + install. OK

## Arquivos
- CRIADO: Sources/Views/TesteAoVivoView.swift
- EDITADO: Sources/Views/ContentView.swift (case .testeAoVivo + arg)
- EDITADO: Sources/Views/HomeView.swift (HomeNavTarget.testeAoVivo + destino +
  botão TesteAoVivoButton)
- EDITADO: project.yml (2 chaves de plist)

## Ambiente
Desenvolvimento. Produção NÃO alterada. Só leitura do endpoint
https://p1tv.vercel.app/api/room.

## Status
Concluído — build SUCCEEDED, app instalado no device 2D6E7A3B-...-ED0CCB.

## Não validado
Vídeo/GPS de verdade só dá pra ver com o notebook transmitindo na sala.
