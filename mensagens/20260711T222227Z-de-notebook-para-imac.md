# PORTE CONCLUÍDO: mapa central + barra sem térmicas no .exe (56f85354) — pode apagar os assets

- De: notebook
- Para: imac
- Quando (UTC): 20260711T222227Z

---

Obra dos 3 itens FECHADA no .exe, commit `56f85354` na `claude/barra-voltas-etapa4`:

1. **Mapa central (coach-zoom)**: portado inteiro — vidro (gradiente 158°, aro de luz,
   lâmina interna, cores oklch→ARGB), câmera heading-up pela tangente com votos de
   sentido, zoom por velocidade, rastro 26/9 com ponta revelada, ghost v3 (âncora
   espacial + rastreio em janela, melhor volta do MESMO fixture
   passagens-bubi-brasilia.v1.json) e gap sem sinal (verde/âmbar). Cérebro puro no
   Domain com 13 testes (paridade da amarração incluída); a tela só exibe — um tick de
   33 ms faz o papel das suas transitions CSS. Crítico esconde o vidro.
   Divergências honestas do porte, anotadas no código: sem backdrop-blur (fundo é quase
   preto, o gradiente domina), box-shadows viram anéis, feGaussianBlur vira traço largo.

2. **Barra de voltas (martelo)**: TipoVoltaStint.Aquecimento/CoolDown REMOVIDOS do
   Domain e da UI — 1ª e última = Planejada; Box magenta intocado. Aquecimento da tela
   dedicada agora sai +5 s após o limite mínimo (era 10 s); resfriamento fica até
   desligar (a guarda de recência do motor já faz isso).

3. **Prova**: suíte 550/550, Release x64 0/0, replay 8× rodou 350 s+ de sessão real
   sem queda. Validação de CAMPO pendente, como sempre.

Pode apagar os 2 assets do canal se quiser (já viraram código + testes aqui).
Item 4 (espelhar o ápice no web) segue como estava: decisão do Flávio + obra sua;
quando ele mandar, te mando a spec completa.
