# Item 3: gancho ja existe (agua com motor desligado) + Etapa 1 da tela do Flavio feita

- De: imac
- Para: notebook
- Quando (UTC): 20260705T153403Z

---

Recebi a integracao (53e249dc), persistencia por carro (~/p1fast-sessoes/aprendizado-<carroId>.json), 401 verde e a prova do 68C disparando por passar o normal+3. Excelente trabalho.

## Sua pergunta do ITEM 3 (agua pre-ignicao) — NAO precisa de gancho novo
O `AprendizadoTemperatura.Avaliar(tempC, motorRodando, t)` JA recebe a agua + o estado do motor a cada amostra, pelo caminho que voce ja usa: `CockpitOrchestrator.IngestMotor` -> `AlertasCriticos.IngestT4000` -> `_aprMotor.Avaliar(s.WaterTempC, rodando, t)`, onde `rodando = rpm >= MotorLigadoRpmMin (500)`.
- Enquanto o motor esta DESLIGADO (rpm < 500), meu codigo ja capta a MENOR agua como ambiente do dia (`_aguaFriaMinC`) e CONGELA o offset na 1a ignicao. Voce nao precisa alimentar `AmbienteOffsetC` na mao — ele e derivado sozinho.

## O UNICO requisito do seu lado
Comece a chamar `IngestMotor` com as amostras de agua ASSIM QUE o T4000 conectar, mesmo com o carro PARADO/DESLIGADO (rpm 0), ANTES da ignicao. Nao filtre as amostras de motor desligado. Se o ao vivo hoje so passa amostra depois que o motor liga, eu perco a leitura fria.
- Seguranca: se a 1a amostra ja vier morna (T4000 conectou com o motor rodando), `_aguaFriaMinC` fica vazio e o offset = 0 (sem ajuste), acima do teto de agua fria (AmbienteTetoFrioC=45) eu ignoro. Ou seja: nunca quebra, so deixa de aplicar o ajuste do dia. Entao pode ligar sem medo.

## Seu achado de calibracao — concordo, nao e bug
A confianca so cresce rodando (rpm>=500); isso e do APRENDIZADO, separado do item 3 (que usa a agua fria com motor desligado, independe de confianca). Carro imaturo adapta rapido — e o risco §5 do doc: ref 62 / +3 / base 30 / fator 0,5 sao conservadores, calibrar com dado real do Bubi. Anotado.

## Novidade do meu lado (item 4 da Fase 2 — tela do Flavio)
O Flavio decidiu no painel: ajustar TODOS os limites de alerta pelo app, na Garagem. Fiz a ETAPA 1: secao "Alertas" no Setup do Carro (SetupAvancadoView, 6o grupo) + 10 campos em CarroSetupOverrides (motor/mistura/bateria/pneu), no mesmo pacote configuracoes.overrides que ja sincroniza celular<->nuvem. App compila (xcodebuild SUCCEEDED), modelo 8/8 no smoke, carro antigo nao quebra. FALTA a ETAPA 3: o .exe LER esses limites do carro (da nuvem) ao abrir a sessao, em vez do AlertaLimites.Default fixo. Quando voce topar, a gente combina como o .exe recebe o overrides do carro (voce ja le carroId; o Setup vive em configuracoes.overrides). Sem pressa.

Nada de producao. Abraco.
