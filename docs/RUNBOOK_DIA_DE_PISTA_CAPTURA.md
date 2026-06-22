# Runbook do dia de pista — captura sem perder dado

Objetivo: que a próxima sessão de pista grave o motor inteiro, recuperável depois,
sem repetir o que aconteceu em 20-21/06 (dado do motor perdido / só parcial).

Este runbook é a parte HUMANA. O programa do notebook já faz o trabalho pesado
(ler, gravar em disco, alarmar se falhar); aqui estão os passos pra ninguém
derrubar a captura por engano.

---

## O que cada fonte usa hoje (importante, pra não confundir)

| Fonte                  | Quem captura                              | Onde fica o dado |
|------------------------|-------------------------------------------|------------------|
| Motor (injeção T4000)  | **programa do notebook**, modo `--gravar` | grava no notebook **e** manda ao vivo pra nuvem (app + Command Box) |
| GPS / posição          | navegador na **Central** (`p1tv`)         | banco local do navegador da Central |
| Vídeo (Osmo Action 6)  | navegador na Central, via Daily.co        | ao vivo (não grava local ainda) |

Ou seja: o `--gravar` cobre o MOTOR — grava nele E, com `--nuvem`, manda ao vivo pra
nuvem com proteção contra queda de internet. O GPS continua sendo o do navegador da
Central, como hoje. Os dois rodam em paralelo no mesmo notebook.

### A chave da nuvem (configurar uma vez no notebook)
O envio pra nuvem precisa da chave de acesso na variável de ambiente `P1FAST_SUPABASE_ANON`
(é a mesma chave pública que o app web já usa). Configure uma vez no notebook e fica valendo.

---

## ANTES de entrar na pista (5 minutos)

1. Carro com chave em **ON** (não só em "acessório") e a central da injeção ligada.
2. Cabo **USB-C ↔ USB-C** da injeção plugado no notebook.
3. Abrir o terminal e rodar o diagnóstico, só pra ver se o notebook enxerga o aparelho:
   ```
   p1fast-t4000-capture --diag
   ```
   Tem que aparecer um candidato (conversor USB-serial). Se aparecer "SEM DRIVER",
   resolver o driver ANTES de ir pra pista.
4. (Opcional, recomendado) Provar que a nuvem responde, ainda na garagem:
   ```
   p1fast-t4000-capture --nuvem-teste
   ```
   Tem que terminar com **`OK — o notebook FALA com a nuvem`**. Se falhar, é internet
   ou a chave (`P1FAST_SUPABASE_ANON`) — resolver antes da pista.
5. Começar a gravação **com envio ao vivo pra produção** (app + Command Box):
   ```
   p1fast-t4000-capture --gravar --nuvem --producao
   ```
   - Sem `--nuvem`: grava só no notebook (sem mandar pra nuvem).
   - Com `--nuvem` sozinho: manda pra um canal de **teste** (não aparece no app real).
   - Com `--nuvem --producao`: manda pro canal real que **todos assistem** ao vivo.

   Em poucos segundos a tela tem que mostrar **`conectado — lendo a T3000`**, depois
   `gravando=sim`, `motor=` subindo (~10 Hz) e `nuvem=online`.
6. Abrir a **Central** no navegador do notebook (endereço de sempre, `p1tv`), pra o GPS
   e o vídeo, como já é feito.

Só vá pra pista quando ver, na janela do `--gravar`: `gravando=sim`, `motor` subindo e
`nuvem=online`.

---

## DURANTE a sessão

- A janela do `--gravar` mostra uma linha por segundo. O que importa:
  - `gravando=sim` — está salvando no notebook.
  - `motor=` subindo — chegando amostra.
  - `descartadas=0` — nada se perdeu na escrita.
  - `nuvem=online` — mandando ao vivo. Se a internet oscilar, vira `nuvem=offline-enfileirando`
    e a `fila=` começa a subir: **isso é normal e seguro** — o dado fica guardado e, quando a
    internet volta, vira `nuvem=online-drenando` e a fila esvazia sozinha (reenvia o período todo).
  - Se aparecer **`*** ALARME: ... ***`**, alguma coisa travou a gravação no disco
    (`perdendo-amostras` = disco com erro; `parada-armazenamento` = disco morreu).
    Nesse caso: liberar espaço em disco / trocar de pasta com `--pasta` e reiniciar.
- Se o cabo do carro cair, o programa **religa sozinho** e volta a gravar. Se a internet
  cair, ele **reenvia sozinho** quando voltar. Não precisa fechar nada. O intervalo da queda
  fica marcado como "lacuna" (honesto, não inventa dado).
- **Não feche a janela do `--gravar` no meio.** Se o notebook reiniciar sozinho, o dado
  já gravado está salvo (o programa recupera a sessão no próximo boot).

---

## DEPOIS da sessão

1. Na janela do `--gravar`, aperte **Q** (ou Esc). Ele encerra e imprime o resumo:
   quantas amostras de motor, duração, descartadas, maior lacuna e o **caminho do arquivo**.
2. Confira o que ficou gravado:
   ```
   p1fast-t4000-capture --conferir
   ```
   Pra cada sessão ele mostra: nº de amostras, se a **sequência está contígua**
   (nada sumiu no meio), lacunas e duração. Sessão boa = `seq=contígua` e duração
   batendo com o tempo real de pista.
3. **Copie a pasta das sessões** (default: `p1fast-sessoes` no perfil do usuário) pra um
   pen drive / nuvem pessoal. É a reserva — o arquivo é a fonte da verdade.
4. Pro GPS/vídeo da Central: usar a página de **Resgate** já no ar
   (`p1tv.vercel.app/resgate`) pra baixar/enviar as sessões do navegador, como em 21/06.

---

## Limites honestos

- **Envio ao vivo pra nuvem com fila: PRONTO e provado.** O notebook conecta na nuvem real
  e publica (testado contra um canal de teste: 30 amostras, 0 erro). A fila que segura e
  reenvia na queda de internet está provada por teste automático. O que falta é só você rodar
  o comando de produção (`--gravar --nuvem --producao`) no dia de pista, com a chave configurada.
- **Detalhe da fila:** ela vive na memória durante a sessão (cobre a internet oscilando). Se o
  notebook DESLIGAR no meio, o que ainda não tinha subido pra nuvem não reenvia sozinho — mas
  **o dado não se perde**: ele está salvo no disco (a fonte da verdade), e dá pra reenviar depois.
- **A prova física da tomada USB** (abrir a porta de verdade com o carro) só fecha no
  notebook, na bancada. Toda a lógica (handshake, montagem do bloco, 10 Hz, religação,
  gravação, recuperação, envio) já está provada por teste automático fora do carro.
- **GPS dentro do programa** (sem depender do navegador) é a Fase 6, ainda não feita.
