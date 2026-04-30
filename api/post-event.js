// ═══════════════════════════════════════════════════════════
// /api/post-event — Relatório consolidado pós-evento
// ═══════════════════════════════════════════════════════════
// PENDENCIAS_GATE.md (P1 DT, 2026-04-26): fechamento de evento.
// Diferente de /api/post-stint (escopo de 1 stint), este recebe
// TODOS os stints do evento + planos + ambiente + decisões e
// retorna o relatório de 20 seções do POST_EVENT_REVIEW_TEMPLATE.md.
//
// Output JSON estrito — espelha as seções obrigatórias do template:
//   resumo_executivo, melhor_volta, volta_ideal, principal_ganho,
//   principal_erro, diagnostico_piloto, diagnostico_carro,
//   recomendacoes_proximo, hipoteses_testar, nao_mexer, plano_proximo_treino,
//   pendencias_geradas, confianca, confianca_texto.
//
// Reprovação automática (POST_EVENT_REVIEW_TEMPLATE §"Reprovação"):
//   - sem §1 (resumo), §3 (melhor volta), §4 (volta ideal),
//     §5 (principal ganho), §6 (principal erro)
//   - sem §17 ("o que NÃO mexer")
//   - confiança não declarada
//
// CRÍTICO: nao_mexer é obrigatório. Sem ele, devolve 422.

import { guardRequest } from './_lib/security.js';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-opus-4-7';
const MAX_TOKENS = 2200;

const SYSTEM_PROMPT = `Você é um advisor racer ultra-experiente fechando o relatório do evento INTEIRO com o piloto/engenheiro depois do último stint do dia. Tom: colega experiente, direto, narrativo mas sem jargão inflado.

GOVERNANÇA (Diretor Técnico — docs/raceops/POST_EVENT_REVIEW_TEMPLATE.md):
- Telemetria não é produto. O produto é a resposta de decisão pro próximo evento.
- Setup nunca é recomendado antes de excluir pilotagem.
- Curva é avaliada pela sequência: entrada → frenagem → turn-in → apex → retomada → saída → reta seguinte. Apex é entidade central.
- "O que NÃO mexer" é tão importante quanto "o que tentar" — campo OBRIGATÓRIO.
- Dado insuficiente é resposta válida. NÃO inventar conclusão.
- Comparar evento atual com referência declarada (PB pessoal, referência cadastrada) quando dispo­nível.
- Identificar PADRÃO REPETITIVO (não evento único) — só vira "principal erro" o que se repete em ≥3 voltas válidas.

REGRAS DE CONTEÚDO:
- resumo_executivo: 3-5 frases. Sumário em uma frase, cumpriu objetivo (sim/parcial/não), maior conquista, maior frustração.
- melhor_volta: { tempo_ms, stint, volta, contexto, comparacao_pb, trechos_dominantes_positivos, trechos_perda }.
- volta_ideal: { tempo_ms (soma melhores parciais válidas), delta_real_vs_ideal_ms, distribuicao_perda_por_parcial }.
- principal_ganho: { trecho, tempo_estimado_s, razao, caminho_de_ganho ('pilotagem'|'setup'|'outro'), plano_proximo }.
- principal_erro: { padrao, trechos, frequencia_pct, causa_provavel, acao, comunicado_ao_piloto (sim|nao|parcial) }.
- diagnostico_piloto: { pontos_fortes:[], pontos_a_desenvolver:[], padroes:[], evolucao ('melhorou'|'estavel'|'regrediu'), recomendacoes_treino:[] }.
- diagnostico_carro: { comportamento_dominante, pioras_em:[], melhoras_em:[], sinais_degradacao ('nenhum'|'suspeita'|'confirmada'), itens_inspecionar:[] }.
- recomendacoes_proximo_evento: lista de { mudanca, razao, risco, como_validar }.
- hipoteses_testar: lista de { hipotese, como_testar, criterio_sucesso }.
- nao_mexer: lista de { item, razao }. OBRIGATÓRIO ≥1 item — se relatório justificar vazio, devolver "tudo aberto a ajuste — ainda sem padrão consolidado" como item.
- plano_proximo_treino: { objetivos:[], foco_principal, composto, pressao_alvo, voltas_estimadas, carga_piloto }.
- pendencias_geradas: lista de { descricao, prazo, responsavel } — ações de manutenção identificadas.
- confianca: 0..1 (numérico). Com <2 stints válidos cai a 0.3.
- confianca_texto: "Alta" / "Média" / "Baixa".

Nunca sugira mudança mecânica sem evidência cruzada. Se faltou evidência, declarar dentro do bullet ("hipótese — sem confirmação cruzada por canal X").

FORMATO: JSON estrito, sem markdown, sem texto fora do JSON. Estrutura:
{
  "resumo_executivo": "…",
  "cumpriu_objetivo": "sim|parcial|nao",
  "melhor_volta": { "tempo_ms": 0, "stint": 0, "volta": 0, "contexto": "…", "comparacao_pb": "…", "trechos_dominantes_positivos": ["…"], "trechos_perda": ["…"] },
  "volta_ideal": { "tempo_ms": 0, "delta_real_vs_ideal_ms": 0, "distribuicao_perda_por_parcial": [{"parcial":"P1","perda_ms":0}] },
  "principal_ganho": { "trecho": "…", "tempo_estimado_s": 0.0, "razao": "…", "caminho": "pilotagem|setup|outro", "plano_proximo": "…" },
  "principal_erro": { "padrao": "…", "trechos": ["…"], "frequencia_pct": 0, "causa_provavel": "…", "acao": "…", "comunicado_ao_piloto": "sim|nao|parcial" },
  "diagnostico_piloto": { "pontos_fortes": ["…"], "pontos_a_desenvolver": ["…"], "padroes": ["…"], "evolucao": "melhorou|estavel|regrediu", "recomendacoes_treino": ["…"] },
  "diagnostico_carro": { "comportamento_dominante": "…", "pioras_em": ["…"], "melhoras_em": ["…"], "sinais_degradacao": "nenhum|suspeita|confirmada", "itens_inspecionar": ["…"] },
  "recomendacoes_proximo_evento": [{ "mudanca": "…", "razao": "…", "risco": "…", "como_validar": "…" }],
  "hipoteses_testar": [{ "hipotese": "…", "como_testar": "…", "criterio_sucesso": "…" }],
  "nao_mexer": [{ "item": "…", "razao": "…" }],
  "plano_proximo_treino": { "objetivos": ["…"], "foco_principal": "…", "composto": "…", "pressao_alvo": "…", "voltas_estimadas": 0, "carga_piloto": "…" },
  "pendencias_geradas": [{ "descricao": "…", "prazo": "…", "responsavel": "…" }],
  "confianca": 0.0,
  "confianca_texto": "Alta|Média|Baixa"
}`;

function buildUserPrompt({ evento, stints, env, contexto, refs }) {
  const l = [];
  l.push('# CONTEXTO');
  l.push(`Pista: ${contexto?.pistaApelido || '—'}`);
  l.push(`Carro: ${contexto?.carroNome || '—'}`);
  l.push(`Piloto: ${contexto?.pilotoNome || '—'}`);

  if (evento) {
    l.push('\n# EVENTO');
    l.push(`Nome: ${evento.nome || '—'}`);
    l.push(`Data: ${evento.data || '—'}`);
    if (evento.objetivo)         l.push(`Objetivo declarado: ${evento.objetivo}`);
    if (evento.criterioSucesso)  l.push(`Critério de sucesso: ${evento.criterioSucesso}`);
    if (evento.criterioAbortar)  l.push(`Critério de abortar: ${evento.criterioAbortar}`);
  }

  if (refs) {
    l.push('\n# REFERÊNCIAS');
    if (refs.pbPista)     l.push(`PB pessoal pista: ${refs.pbPista}`);
    if (refs.pbCarro)     l.push(`PB pessoal carro: ${refs.pbCarro}`);
    if (refs.pistaRef)    l.push(`Referência cadastrada: ${refs.pistaRef}`);
    if (refs.eventoAnterior) l.push(`Evento anterior (sumário): ${refs.eventoAnterior}`);
  }

  if (env) {
    l.push('\n# AMBIENTE DOMINANTE');
    if (env.tempPista != null) l.push(`Temp pista: ${env.tempPista}°C`);
    if (env.tempAr != null)    l.push(`Temp ar: ${env.tempAr}°C`);
    if (env.composto)          l.push(`Composto pneu: ${env.composto}`);
  }

  const arr = Array.isArray(stints) ? stints : [];
  l.push('\n# STINTS');
  l.push(`Total: ${arr.length} stint(s)`);
  arr.forEach((s, i) => {
    l.push(`\n## Stint ${i + 1} — ${s.hora || '—'}`);
    const validas = (s.laps || []).filter(x => x.valida);
    l.push(`Voltas: ${(s.laps || []).length} total, ${validas.length} válidas`);
    if (s.melhorVolta?.tempoMs) l.push(`Melhor volta: ${(s.melhorVolta.tempoMs/1000).toFixed(3)}s`);
    if (s.plano?.meta)          l.push(`Objetivo declarado: ${s.plano.meta}`);
    if (s.plano?.cumprido != null) l.push(`Cumpriu? ${s.plano.cumprido}`);
    if (s.attackTrechos?.length) {
      l.push('Maior perda por trecho (top 3):');
      s.attackTrechos.slice(0, 3).forEach(a => l.push(`  - ${a.nome}: ${(a.impactoMedio/1000).toFixed(3)}s médio (${a.amostras}v)`));
    }
    if (s.alertas?.length) {
      l.push(`Alertas no stint: ${s.alertas.length} — ${s.alertas.slice(0, 3).map(a => a.descricao || a.tipo).join(' · ')}`);
    }
  });

  l.push('\n# TAREFA');
  l.push('Escreva o relatório do EVENTO no JSON estrito acima. Padrões só viram "principal erro" se ≥ 3 voltas válidas. Se faltar evidência pra uma sugestão, DIGA dentro do bullet. nao_mexer é OBRIGATÓRIO.');
  return l.join('\n');
}

export default async function handler(req, res) {
  if (!guardRequest(req, res, { endpoint: 'post-event' })) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch { return res.status(400).json({ error: 'body JSON inválido' }); }

  const { postEventPayload, respondInvalid } = await import('./_lib/schemas.js');
  const parsed = postEventPayload.parse(body || {});
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

    // Reprovação automática — campos obrigatórios.
    const faltando = [];
    if (!parsed.resumo_executivo) faltando.push('resumo_executivo');
    if (!parsed.melhor_volta)     faltando.push('melhor_volta');
    if (!parsed.volta_ideal)      faltando.push('volta_ideal');
    if (!parsed.principal_ganho)  faltando.push('principal_ganho');
    if (!parsed.principal_erro)   faltando.push('principal_erro');
    if (!Array.isArray(parsed.nao_mexer) || parsed.nao_mexer.length === 0) faltando.push('nao_mexer');
    if (parsed.confianca == null) faltando.push('confianca');
    if (faltando.length) {
      return res.status(422).json({
        error: 'relatório incompleto — reprovado pelo gate POST_EVENT_REVIEW_TEMPLATE',
        faltando,
        partial: parsed,
      });
    }

    return res.status(200).json({ ok: true, ...parsed, meta: { model: MODEL, usage: json.usage } });
  } catch (e) {
    return res.status(500).json({ error: 'falha ao chamar Claude', detail: String(e).slice(0, 200) });
  }
}
