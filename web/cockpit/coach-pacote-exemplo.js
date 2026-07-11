// coach-pacote-exemplo.js — SNAPSHOT do pacote REAL do Coach (CONSTRUTORA TELA · M2).
// Fonte: coach-ia-sala/construcao/pacote-exemplo.json — gerado pelo cerebro-coach-stint.js do
// fixture REAL (Bubi 23-24/05) e AUDITADO pelo Fable. Eleição real = Curva "S" p25 0,996 s,
// subTrecho null (curva inteira), SÓ âmbar (decisão 3). A tela só EXIBE este pacote pronto.
// (Substituiu o ANDAIME do M1.) _meta da origem:
// {"origem":"gerado do fixture REAL passagens-bubi-brasilia.v1.json (Bubi 23-24/05) pelo cerebro-coach-stint.js","caminho":"Fase 1 — subTrecho:null (curva inteira), passo 0 (linhas de trecho curtas p/ curvas rápidas)","decisoes":"ganho=p25 (decisão 9 conservador) · SÓ âmbar/verde (decisão 3) · N1+N2 · gate SF","outlaps":[1,5],"mediana_lap_s":71.005}

export const COACH_PACOTES_EXEMPLO = [
  {
    "versao": 1,
    "tipo": "oportunidade",
    "id": "v3-96ba-curva",
    "oportunidade": {
      "id": "v3-96ba-curva",
      "geradaNaVolta": 3,
      "tipo": "curva-pontual",
      "tecnica": null,
      "tipoCurva": "T4",
      "segmentId": "96baf23c-1b45-5bd6-8d07-a4d3c1670161",
      "curvaNome": "CURVA \"S\"",
      "subTrecho": null,
      "ganhoVoltaS": 0.996,
      "ganhoStintS": 4.183,
      "confianca": {
        "nivel": "media",
        "valor": 0.648,
        "origem": "derivada-J2"
      },
      "reconciliacao": {
        "tempoTrechoAtualS": 6,
        "tempoTrechoRefS": 5.004,
        "gapMedidoS": 0.996,
        "deltaTotalIntegradoS": null,
        "escala": 1
      },
      "projecao": {
        "voltasRestantes": 7,
        "adesao": 0.6,
        "base": "projetada"
      },
      "evidencia": {
        "voltasObservadas": [
          2,
          3,
          4,
          6,
          7
        ],
        "ocorrencias": [
          {
            "segmentId": "96baf23c-1b45-5bd6-8d07-a4d3c1670161",
            "curvaNome": "CURVA \"S\"",
            "subTrecho": null,
            "deltaS": 0.996
          }
        ],
        "deltaMedioS": 1.394
      },
      "referencia": {
        "tipoPneu": "radial-185-14",
        "tempoTrechoS": 5.004
      },
      "apice": null,
      "tracos": {
        "atual": [
          {
            "lat": -15.7776497913189,
            "lng": -47.9021314044329,
            "kmh": 99.1761520376401,
            "t": 1779562625083,
            "fracao": 0,
            "sub": null
          },
          {
            "lat": -15.7774826888259,
            "lng": -47.9018505893643,
            "kmh": 109.669036101039,
            "t": 1779562626088,
            "fracao": 0.1627487185324121,
            "sub": null
          },
          {
            "lat": -15.7774478526863,
            "lng": -47.9015236507513,
            "kmh": 107.528665922893,
            "t": 1779562627084,
            "fracao": 0.3248915342426035,
            "sub": null
          },
          {
            "lat": -15.7774828390587,
            "lng": -47.9012236145319,
            "kmh": 109.669036101045,
            "t": 1779562628085,
            "fracao": 0.473870280461428,
            "sub": null
          },
          {
            "lat": -15.777529210009,
            "lng": -47.9008804488495,
            "kmh": 115.548472593753,
            "t": 1779562629078,
            "fracao": 0.6446864935329779,
            "sub": null
          },
          {
            "lat": -15.7775911265078,
            "lng": -47.9005263180463,
            "kmh": 120.976103208771,
            "t": 1779562630079,
            "fracao": 0.8221059347222665,
            "sub": null
          },
          {
            "lat": -15.7776309637032,
            "lng": -47.9001678089815,
            "kmh": 120.976103208771,
            "t": 1779562631083,
            "fracao": 1,
            "sub": null
          }
        ],
        "referencia": [
          {
            "lat": -15.7776400893781,
            "lng": -47.9019347878138,
            "kmh": 97.6026763907127,
            "t": 1779651547085,
            "fracao": 0,
            "sub": null
          },
          {
            "lat": -15.7774423886853,
            "lng": -47.9017435169515,
            "kmh": 99.2494514455992,
            "t": 1779651548084,
            "fracao": 0.17662742103049106,
            "sub": null
          },
          {
            "lat": -15.7774122853471,
            "lng": -47.9014224555311,
            "kmh": 104.196478270411,
            "t": 1779651549089,
            "fracao": 0.3796112348113784,
            "sub": null
          },
          {
            "lat": -15.777517407686,
            "lng": -47.9010661860753,
            "kmh": 107.605117033732,
            "t": 1779651550091,
            "fracao": 0.614094262391981,
            "sub": null
          },
          {
            "lat": -15.7775648691808,
            "lng": -47.9007639175865,
            "kmh": 107.605117033731,
            "t": 1779651551089,
            "fracao": 0.8068111117624682,
            "sub": null
          },
          {
            "lat": -15.7776228983967,
            "lng": -47.9004628817848,
            "kmh": 112.006851194957,
            "t": 1779651552089,
            "fracao": 1,
            "sub": null
          }
        ]
      },
      "_foco": false
    },
    "mensagem": {
      "n1": {
        "linhas": [
          "Curva \"S\" · 1,0 s"
        ],
        "acento": "ambar"
      },
      "n2": {
        "linhas": [
          "CURVA \"S\"",
          "você perde tempo aqui",
          "carregue mais   1,0 s"
        ],
        "acento": "ambar"
      },
      "n3": null,
      "estado": null
    },
    "grafico": {
      "versao": 1,
      "segmentId": "96baf23c-1b45-5bd6-8d07-a4d3c1670161",
      "rotulo": "CURVA \"S\"",
      "acento": "ambar",
      "recorte": {
        "espaco": "desenho-823x799",
        "viewBox": {
          "x": 229.9,
          "y": 518,
          "w": 159.1,
          "h": 19.9
        },
        "contextoIdx": {
          "de": 195,
          "ate": 215
        }
      },
      "camadas": {
        "pistaContexto": true,
        "linhaReferencia": true,
        "linhaPiloto": true,
        "apice": false,
        "destaqueSub": false,
        "fitaMetrica": null
      },
      "recorrencia": null,
      "degradado": null
    },
    "timing": {
      "portao": "fim-de-volta",
      "nivel": "N2",
      "podeMostrar": true,
      "duracaoMs": 3000,
      "prioridade": "critica-vence"
    },
    "geradoEmVoltaN": 3
  },
  {
    "versao": 1,
    "tipo": "silencio",
    "status": {
      "estado": "coletando-dados",
      "voltasObservadas": 2,
      "motivo": "2 voltas — junto mais dado antes de apontar"
    },
    "linha": {
      "texto": "Juntando dado — 2 voltas",
      "cor": "neutra"
    }
  },
  null
];
