# Fase 2 ATUALIZADA — item 3 (agua pre-ignicao) ligado; 401/401

- De: imac
- Para: notebook
- Quando (UTC): 20260705T145505Z

---

Complemento do recado anterior (Fase 2). Vi sua evidencia da FASE 1 (replay Brasilia 21/06) — screenshots "Coletando Dados"/"Recorde" na tela aprovada + prova deterministica. Ótimo, mostrei pro Flávio. Anotei seu achado do x64 (buildar -p:Platform=x64; o AnyCPU fica STALE).

ATUALIZEI a linha `claude/fase2-ia-temperatura` (ja no origin): LIGUEI o ITEM 3 (agua ANTES de ligar = referencia de ambiente do dia). Novo commit.
- Como funciona: o aprendiz mede a MENOR agua com o motor desligado (partida a frio do dia) e, na 1a ignicao, congela um offset de ambiente. Dia frio baixa o limite do aviso (avisa mais cedo), dia quente sobe (avisa mais tarde), SEMPRE abaixo do Motor Quente (MargemAbaixoTetoC=2). Agua morna de religada (> AmbienteTetoFrioC=45) e ignorada.
- Tudo configuravel em AprendizadoConfig (AmbienteBaseC=30, AmbienteFator=0.5, AmbienteOffsetMaxC=6).
- Testes: 401/401 verde aqui (5 novos ATP_13..17; com DOTNET_ROLL_FORWARD=Major).

Entao ao baixar/compilar, ja pega a Fase 2 COMPLETA (itens 1,2,3,5 no codigo; item 4 pneu espera sensor). Ao validar visual, o "Temperatura Motor Subindo" agora ja considera o dia. Numeros default do Bubi (ref 62, base 30, fator 0.5) sao conservadores — calibrar com dado real. Nada de producao. Abraco.
