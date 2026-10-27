// tipos-curva-texto.js — explicação em LINGUAGEM SIMPLES de cada tipo de curva (camada pedagógica).
// A definição técnica canônica mora em classificador-trecho.js (TIPOS: rotulo + formato). Aqui fica
// só o texto fácil, em UM lugar só, pra a página de explicação e a tela de escolha do app usarem a
// mesma fonte (sem duplicar e sem divergir). Escrito para o Flávio, sem jargão.
export const TEXTO_FACIL = {
  T0: 'A curva "padrão" de velocidade média. Você freia forte no comecinho e vai soltando o freio aos poucos, de forma suave e constante, até o ponto mais fechado da curva (o ápice). É o caso mais comum — pense nela como a referência.',
  T1: 'Vem logo depois de uma reta, com o carro voando, e exige uma freada pesada para uma curva bem lenta (tipo um grampo). Pisa com tudo no freio no início e vai soltando bem devagar — o próprio freio ainda ajuda o carro a girar para dentro.',
  T2: 'A curva vai FECHANDO conforme você entra: começa mais aberta e termina mais apertada. Freia parcial no início e mantém um restinho de freio até o ponto mais fechado, soltando só no finalzinho. Exige paciência.',
  T3: 'Curva rápida em que você quase não freia: só um toque curto, ou apenas tira o pé do acelerador, para assentar a frente do carro. Não é para reduzir velocidade — é para firmar a dianteira e passar rápido.',
  T4: 'Duas ou mais curvas grudadas, uma logo após a outra, em direções diferentes (tipo um "S"). O que importa não é sair bem desta, e sim já chegar bem posicionado na PRÓXIMA. Mantém um restinho de freio até a troca de direção.',
  T5: 'O contrário da T2: a curva vai ABRINDO conforme você sai. Atinge o ponto mais fechado cedo, freia por pouco tempo e já acelera cedo. É "ouro" para carro de tração dianteira como o Bubi.',
  SF: 'Curva de "pé embaixo": rápida o suficiente para fazer sem tirar o pé do acelerador. Não tem freada nenhuma. É quase uma reta com uma dobradinha.',
  ND: 'Não é um tipo de curva — é o sistema sendo honesto: "com o dado de hoje, não dá para afirmar o tipo com segurança". Some quando chegar dado melhor (captura a 25 leituras por segundo).',
};
