// ═══════════════════════════════════════════════════════════
// /api/post-stint — Análise pós-stint narrativa (F2 do plano)
// ═══════════════════════════════════════════════════════════
// Claude recebe TODAS as voltas + env + plano + execução e retorna:
//   • resumo narrativo curto (3-4 frases)
//   • 3 pontos-chave { o_que_funcionou, o_que_nao, o_que_tentar }
//   • destaque (volta/trecho de maior ganho ou maior perda)
//
// Output JSON estrito:
//   { resumo, funcionou:[], nao_funcionou:[], tentar:[], destaque, confianca }

import { guardRequest } from './_lib/security.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-opus-4-7';
const MAX_TOKENS = 1400;

const SYSTEM_PROMPT = `Você é um advisor racer ultra-experiente revisando um stint inteiro com o piloto/engenheiro no box logo após o retorno. Tom: colega experiente, direto, sem jargão inflado. Narrativo mas conciso.

GOVERNANÇA (Diretor Técnico — docs/raceops/):
- Telemetria não é produto. O produto é a resposta de decisão.
- Setup nunca é recomendado antes de excluir pilotagem.
- Curva é avaliada pela sequência: entrada → frenagem → turn-in → apex → retomada → saída → reta seguinte. Nunca só por velocidade de entrada. Apex é entidade central — classificar quando dado disponível (correto / antecipado / tardio / perdido por fora / interno demais / sacrificado).
- "O que NÃO mexer" é tão importante quanto "o que tentar".
- Dado insuficiente é resposta válida — NÃO inventar conclusão.

REGRAS:
- resumo: 3 a 4 frases. Foca no que o stint conta como história (ritmo, evolução, onde saiu certo/errado).
- funcionou: 1-3 bullets curtos do que andou bem (frases ≤ 14 palavras).
- nao_funcionou: 1-3 bullets curtos de falhas concretas (frase + local/trecho quando aplicável). Para cada falha em curva, indicar em qual ponto da sequência (entrada / frenagem / turn-in / apex / retomada / saída).
- tentar: 1-3 bullets com ação concreta pro próximo stint (pilotagem OU setup — um por vez, nunca dois acoplados). Pilotagem antes de setup.
- nao_mexer: 1-3 bullets com itens que estão BONS e NÃO devem ser alterados. Campo OBRIGATÓRIO. Se vazio, justificar: "tudo aberto a ajuste — ainda sem padrão consolidado".
- destaque: UM evento ou trecho memorável do stint (ex: "Melhor volta veio com entrada refinada na Curva da Bruxa").
- confianca: 0..1. Com <5 voltas válidas cai a 0.3.
- confianca_texto: "Alta" / "Média" / "Baixa" — alinhada ao numérico.

Nunca sugira mudanças mecânicas sem evidência. Se faltou evidência, diga no bullet.

FORMATO: JSON estrito, sem markdown, sem texto fora do JSON.
{
  "resumo": "…",
  "funcionou": ["…"],
  "nao_funcionou": ["…"],
  "tentar": ["…"],
  "nao_mexer": ["…"],
  "destaque": "…",
  "confianca": 0.0,
  "confianca_texto": "Alta|Média|Baixa"
}`;

function buildUserPrompt({ stint, env, plano, contexto }) {
  const l = [];
  l.push('# CONTEXTO');
  l.push(`Pista: ${contexto?.pistaApelido || '—'}`);
  l.push(`Carro: ${contexto?.carroNome || '—'}`);
  l.push(`Piloto: ${contexto?.pilotoNome || '—'}`);

  if (plano) {
    l.push('\n# PLANO DECLARADO');
    l.push(`Meta: ${plano.meta || '—'}`);
    l.push(`Abordagem: ${plano.abordagem || '—'}`);
    if (plano.trechosFoco?.length) l.push(`Trechos-foco: ${plano.trechosFocoNomes?.join(', ') || plano.trechosFoco.join(', ')}`);
  }

  l.push('\n# AMBIENTE');
  if (env?.tempPista != null) l.push(`Temp pista: ${env.tempPista}°C`);
  if (env?.tempAr != null)    l.push(`Temp ar: ${env.tempAr}°C`);
  if (env?.composto)          l.push(`Pneu: ${env.composto}`);
  if (env?.pressaoD != null)  l.push(`Pressão D/T (saída): ${env.pressaoD} / ${env.pressaoT} bar`);

  const validas = (stint?.laps || []).filter(x => x.valida);
  l.push('\n# EXECUÇÃO');
  l.push(`Voltas: ${stint?.laps?.length || 0} total, ${validas.length} válidas`);
  if (stint?.melhorVolta?.tempoMs) l.push(`Melhor volta: ${(stint.melhorVolta.tempoMs/1000).toFixed(3)}s`);

  if (validas.length) {
    l.push('\n## Voltas válidas (numero, tempoMs):');
    validas.slice(0, 20).forEach(lap => l.push(`- v${lap.numero}: ${(lap.tempoMs/1000).toFixed(3)}s`));
  }

  if (stint?.attackTrechos?.length) {
    l.push('\n## Maior perda por trecho:');
    stint.attackTrechos.slice(0, 5).forEach(a => l.push(`- ${a.nome}: ${(a.impactoMedio/1000).toFixed(3)}s médio (${a.amostras}v)`));
  }

  l.push('\n# TAREFA');
  l.push('Escreva o pós-stint no JSON estrito acima. Se faltar evidência pra uma sugestão, DIGA dentro do bullet.');
  return l.join('\n');
}

export default async function handler(req, res) {
  if (!guardRequest(req, res, { endpoint: 'post-stint' })) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: 'body JSON inválido' }); }

  const { postStintPayload, respondInvalid } = await import('./_lib/schemas.js');
  const parsed = postStintPayload.parse(body || {});
  if (!parsed.ok) return respondInvalid(res, parsed);

  const userPrompt = buildUserPrompt(parsed.value);

  try {
    const r = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!r.ok) {
      const errTxt = await r.text();
      return res.status(502).json({ error: 'anthropic upstream', detail: errTxt.slice(0, 400) });
    }
    const json = await r.json();
    const text = json?.content?.[0]?.text || '';
    let parsed;
    try { parsed = JSON.parse(text); }
    catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
    }
    if (!parsed) return res.status(500).json({ error: 'resposta não é JSON válido', raw: text.slice(0, 400) });

    return res.status(200).json({ ok: true, ...parsed, meta: { model: MODEL, usage: json.usage } });
  } catch (e) {
    return res.status(500).json({ error: 'falha ao chamar Claude', detail: String(e).slice(0, 200) });
  }
}
