// ═══════════════════════════════════════════════════════════
// /api/advisor — Setup Advisor (proxy pra Claude API)
// ═══════════════════════════════════════════════════════════
// Vercel serverless function (Node runtime). Não expõe chave pro cliente.
// Requer env var: ANTHROPIC_API_KEY
// Opcionais: FAM_ALLOWED_ORIGINS, FAM_RATE_LIMIT_PER_MIN (api/_lib/security.js)
//
// Input (POST JSON):
//   {
//     stint: { laps, parciais, trechos, melhorVolta, melhorPorParcial, melhorPorTrecho, attackTrechos },
//     env:   { pressaoD, pressaoT, pneuTempD[4], pneuTempT[4], desgasteNivelD, desgasteNivelT, composto, tempPista, tempAr },
//     objetivo: string (opcional — ex: "melhorar CURVA DA BRUXA"),
//     contexto: { pistaApelido, carroNome, pilotoNome }
//   }
//
// Output (JSON):
//   {
//     sugestao: string curto (1 frase),
//     racional: string (2-3 frases),
//     prioridade: string (nome do trecho),
//     ajustes: [{ campo, de, para, motivo }],
//     confianca: 0..1,
//     evidencias: string[]
//   }

import { guardRequest } from './_lib/security.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-opus-4-7';
const MAX_TOKENS = 1200;

const SYSTEM_PROMPT = `Você é um advisor racer ultra-experiente, engenheiro de corrida com 30 anos de track day e corridas amadoras/profissionais. Sua missão é analisar dados de stint do carro/piloto e propor ajustes concretos de setup + foco de pilotagem, ENXUTOS e ACIONÁVEIS.

GOVERNANÇA (Diretor Técnico — docs/raceops/):
- Telemetria não é produto. O produto é a resposta de decisão.
- Toda recomendação segue: pergunta → resposta curta → evidência → causa → ação → risco → confiança → como validar.
- Setup nunca é recomendado antes de excluir erro de pilotagem. Excluir nesta ordem: pilotagem → pneu → tráfego → degradação mecânica não-setup → só então setup.
- Curva é avaliada pela sequência: entrada → frenagem → turn-in → apex → retomada do acelerador → saída → reta seguinte. Nunca só por velocidade de entrada. Apex é entidade central: classificar (correto / antecipado / tardio / perdido por fora / interno demais / sacrificado).
- "O que NÃO mexer" é tão importante quanto "o que mexer". Sempre listar.

FINDINGS CODIFICADOS (Camada 2 — quando presentes no payload):
- O payload pode trazer um campo "findings": array de achados determinísticos emitidos pela Camada 2 (CalibrationEngine) do Command Box Engenharia (MS-16.3). Cada finding tem id, ruleId, severidade, confiança, escopo, evidência objetiva.
- Findings são HIPÓTESES PRÉ-VALIDADAS pela camada determinística. NÃO inventar causalidade contra eles.
- Sua tarefa quando há findings: (a) PRIORIZAR — qual atacar primeiro e por quê, (b) EXPLICAR pro engenheiro/chefe a evidência em linguagem técnica de pista, (c) SUGERIR como validar no próximo stint, (d) DETECTAR CONFLITO se dois findings se contradizem (ex: λ pobre + Vmin caindo no mesmo trecho podem ser causa comum ou independentes), (e) REDUZIR CONFIANÇA quando evidência for fraca ou stint tiver poucas voltas.
- NÃO contradizer findings determinísticos sem motivo explícito (cite o motivo se contradizer).
- Findings com confiança "Baixa" merecem investigação extra antes de virar recomendação — vale dizer "precisa de mais voltas".

FILOSOFIA:
- Brevidade brutal. Frase única de sugestão (máx 14 palavras).
- Ajustes concretos (campo, de, para, motivo curto).
- Prioridade = um trecho específico por vez.
- Sem jargão genérico ("trabalhar traçado"). Fale de ajuste mecânico real OU de fase da curva (entrada / frenagem / turn-in / apex / retomada / saída).
- Se < 5 voltas válidas: dizer e NÃO sugerir mudança mecânica.
- Confiança em texto: "Alta" (5+ voltas consistentes, padrão claro), "Média" (3-4 voltas ou padrão parcial), "Baixa" (<3 voltas ou sinal misturado).

FORMATO DE RESPOSTA — JSON ESTRITO, sem markdown, sem texto fora do JSON:
{
  "sugestao": "…",
  "racional": "…",
  "prioridade": "CURVA X",
  "ajustes": [{"campo":"…","de":"…","para":"…","motivo":"…","risco":"…"}],
  "nao_mexer": ["item 1 que está bom e NÃO deve ser alterado", "item 2"],
  "como_validar": "o que comparar no próximo stint para confirmar a sugestão",
  "confianca": 0.0,
  "confianca_texto": "Alta|Média|Baixa",
  "evidencias": ["…"]
}

Se faltar dado pra análise responsável, retorne:
{ "sugestao": "Mais voltas válidas antes de ajustar setup.", "racional": "…", "prioridade": "—", "ajustes": [], "nao_mexer": ["nada — sem dado para sustentar mudança"], "como_validar": "rodar mais 5 voltas válidas em condição estável", "confianca": 0.2, "confianca_texto": "Baixa", "evidencias": ["…"] }`;

function buildUserPrompt({ stint, env, objetivo, contexto, findings }) {
  const lines = [];
  lines.push(`# CONTEXTO`);
  lines.push(`Pista: ${contexto?.pistaApelido || '—'}`);
  lines.push(`Carro: ${contexto?.carroNome || '—'}`);
  lines.push(`Piloto: ${contexto?.pilotoNome || '—'}`);
  if (objetivo) lines.push(`Objetivo declarado: ${objetivo}`);

  lines.push(`\n# AMBIENTE`);
  if (env?.tempPista != null) lines.push(`Temperatura pista: ${env.tempPista}°C`);
  if (env?.tempAr != null)    lines.push(`Temperatura ar: ${env.tempAr}°C`);
  if (env?.composto)          lines.push(`Composto pneu: ${env.composto}`);

  lines.push(`\n# PNEU`);
  if (env?.pressaoD != null)  lines.push(`Pressão dianteira (saída box): ${env.pressaoD} bar`);
  if (env?.pressaoT != null)  lines.push(`Pressão traseira (saída box): ${env.pressaoT} bar`);
  if (env?.pneuTempD?.length) lines.push(`Pirômetro dianteiro (4 pts, pós-stint): ${env.pneuTempD.join(' / ')}°C`);
  if (env?.pneuTempT?.length) lines.push(`Pirômetro traseiro (4 pts, pós-stint): ${env.pneuTempT.join(' / ')}°C`);
  if (env?.desgasteNivelD != null) lines.push(`Desgaste nível dianteiro: ${env.desgasteNivelD}/3 (0=novo, 3=usado)`);
  if (env?.desgasteNivelT != null) lines.push(`Desgaste nível traseiro: ${env.desgasteNivelT}/3`);

  lines.push(`\n# STINT`);
  lines.push(`Voltas válidas: ${stint?.laps?.filter(l => l.valida).length || 0} / ${stint?.laps?.length || 0}`);
  if (stint?.melhorVolta?.tempoMs) lines.push(`Melhor volta: ${(stint.melhorVolta.tempoMs/1000).toFixed(3)}s`);
  if (stint?.parciais?.length) {
    lines.push(`\n## Parciais (N=${stint.parciais.length}):`);
    for (const p of stint.parciais) {
      const best = stint.melhorPorParcial?.[p.id]?.tempoMs;
      lines.push(`- ${p.nome} (${p.apelido || p.id}): melhor ${best != null ? (best/1000).toFixed(3) + 's' : '—'}`);
    }
  }
  if (stint?.attackTrechos?.length) {
    lines.push(`\n## Trechos com maior impacto (delta médio vs melhor):`);
    for (const a of stint.attackTrechos.slice(0, 5)) {
      lines.push(`- ${a.nome}: ${(a.impactoMedio/1000).toFixed(3)}s perdidos em média (${a.amostras} amostras)`);
    }
  }

  // MS-16.4 — findings codificados (Camada 2 CalibrationEngine)
  if (Array.isArray(findings) && findings.length > 0) {
    lines.push(`\n# FINDINGS CODIFICADOS (Camada 2 determinística)`);
    lines.push(`São ${findings.length} achado(s) pré-validados. Priorize, explique, sugira validação. NÃO contradiga sem motivo explícito.`);
    for (const f of findings) {
      const escopoTxt = f.segmentId ? `${f.escopo || 'segment'} ${f.segmentId}`
                        : (f.lapNumero ? `${f.escopo || 'lap'} v${f.lapNumero}` : (f.escopo || 'stint'));
      lines.push(`\n## ${f.titulo} (${f.ruleId})`);
      lines.push(`Severidade: ${f.severidade} · Confiança: ${f.confianca} · Escopo: ${escopoTxt}`);
      if (f.descricao) lines.push(`${f.descricao}`);
    }
  }

  lines.push(`\n# TAREFA`);
  if (Array.isArray(findings) && findings.length > 0) {
    lines.push(`Priorize os findings codificados em "FINDINGS CODIFICADOS" acima e produza recomendação(ões) acionáveis no JSON estrito. Liste "nao_mexer" explicitamente. Se findings se contradizem ou parecem dependentes, mencione isso no campo "racional".`);
  } else {
    lines.push(`Analise os dados acima e responda no JSON estrito. Se faltar evidência, diga.`);
  }
  return lines.join('\n');
}

export default async function handler(req, res) {
  if (!guardRequest(req, res, { endpoint: 'advisor' })) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'body JSON inválido' });
  }

  // Schema check antes de gastar token Anthropic — economiza tempo + créditos.
  const { advisorPayload, respondInvalid } = await import('./_lib/schemas.js');
  const parsed = advisorPayload.parse(body || {});
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
    try {
      parsed = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch {} }
    }
    if (!parsed) {
      return res.status(500).json({ error: 'resposta não é JSON válido', raw: text.slice(0, 400) });
    }
    return res.status(200).json({
      ok: true,
      ...parsed,
      meta: { model: MODEL, usage: json.usage },
    });
  } catch (e) {
    return res.status(500).json({ error: 'falha ao chamar Claude', detail: String(e).slice(0, 200) });
  }
}
