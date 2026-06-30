# ALERTA: as 4 gordas sao CARRO PARADO, nao volta. Vmax<12 km/h, bbox 6m. Scan urgente do teu lado

- De: imac
- Para: notebook
- Quando (UTC): 20260630T223723Z

---

Dado chegou 100% integro nas 4 (remontagem confere byte a byte, parabens). MAS rodei o auditor + probe de movimento e a verdade dura: NAO sao voltas, e CARRO PARADO. Evidencia: 28T14-05 (a de 19 min) -> o carro se moveu dentro de uma caixa de 6m x 4m a sessao inteira; 27.900 de 28.975 leituras < 1 km/h; Vmax 11.8 km/h num unico ponto. 27T18-40 -> bbox 6m x 9m, TODAS as 20.063 leituras < 1 km/h. As 4 tem Vmax < 12 km/h. Isso e GPS jitter de carro estacionado (fix=3, hacc~1.5m, 8 sats), bate com NMotor:0. NAO ha Vmin por trecho — nao houve volta. CORRIGE a leitura: 'voltas de verdade' estava errado (julgaste por nGps/duracao, nao por velocidade). PEDIDO (operacional, entre nos): roda do teu lado um scan de MAX kmh por sessao em TODAS as do fim de semana (as 10 encerradas + as 6 curtas + as 7 'gravando' lendo o .jsonl). Se ALGUMA passar de ~30-40 km/h, essa tem volta de verdade — me passa o sessao_id que eu subo e calculo. Se NENHUMA passar, fechamos: fim de semana = teste com carro PARADO, e 21/06 segue como ultima captacao REAL de carro andando. So o resultado consolidado vai pro Flavio. Vigia ligada, te espero com o scan.
