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
4. Começar a gravação:
   ```
   p1fast-t4000-capture --gravar
   ```
   Em poucos segundos a tela tem que mostrar **`conectado — lendo a T3000`** e, logo
   depois, linhas com `gravando=sim` e `motor=` subindo e um Hz por volta de 10.
5. Abrir a **Central** no navegador do notebook (endereço de sempre, `p1tv`), pra o GPS
   e o vídeo, como já é feito.

Só vá pra pista quando ver, na janela do `--gravar`: `gravando=sim` e `motor` subindo.

---

## DURANTE a sessão

- A janela do `--gravar` mostra uma linha por segundo. O que importa:
  - `gravando=sim` — está salvando.
  - `motor=` subindo — chegando amostra.
  - `descartadas=0` — nada se perdeu na escrita.
  - Se aparecer **`*** ALARME: ... ***`**, alguma coisa travou a gravação
    (`perdendo-amostras` = disco com erro; `parada-armazenamento` = disco morreu).
    Nesse caso: liberar espaço em disco / trocar de pasta com `--pasta` e reiniciar.
- Se o cabo cair no meio, o programa **religa sozinho** e volta a gravar. Não precisa
  fechar nada. O intervalo da queda fica marcado como "lacuna" (honesto, não inventa dado).
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

## Limites honestos (o que este passo NÃO faz ainda)

- **Não envia o motor pra nuvem ao vivo** com fila à prova de queda de internet. Isso é a
  Fase 3 do plano (nuvem com fila) e está EM ABERTO — decisão sua (há uma decisão de 21/06
  de "manter local, sem upload agora"). Enquanto isso, o motor fica salvo LOCAL e seguro.
- **A prova física da tomada USB** (abrir a porta de verdade com o carro) só fecha no
  notebook, na bancada. Toda a lógica (handshake, montagem do bloco, 10 Hz, religação,
  gravação, recuperação) já está provada por teste automático fora do carro.
- **GPS dentro do .exe** (sem depender do navegador) é a Fase 6, ainda não feita.
