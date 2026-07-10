// MapeamentoPista — CONTRATOS do mapeamento automático de pista desconhecida.
//
// Obra aprovada pelo Flávio 2026-07-10 ("rodando em pista nova, vai mapeando a cada volta e
// criando a pista com os trechos"), desenho em .claude-exec/DESENHO-MAPEAMENTO-PISTA-2026-07-10.md.
// Decisões fechadas: D1 = trechos congelam com 2 cortes consecutivos consistentes; D2 = pista
// aprendida PERSISTE entre dias (local, como os recordes); D3 = calibrado pro Bubi (voltas > 40 s).
//
// Este arquivo tem SÓ os tipos compartilhados (contrato entre o MapeadorPista — fecho da volta —
// e o CortadorTrechos — segmentação/persistência). Escrito pelo coordenador pra fixar a fronteira;
// as implementações vivem em MapeadorPista.cs e CortadorTrechos.cs/PistaStore.cs.
//
// Regras duras da obra: Brasília hardcoded VENCE dentro da caixa dela (PistaBrasilia); a tela é
// honesta enquanto mapeia (nunca inventa delta); tudo local (nuvem não é pré-requisito); Domain
// puro (relógio/IO vêm de fora; IO só no PistaStore, isolado como o RecordesStore).

namespace P1Fast.Cockpit.Domain;

/// <summary>Estado do mapeamento de uma pista desconhecida (dirige o aviso honesto da tela).</summary>
public enum MapeamentoEstado
{
    /// <summary>Rastreando a trilha; ainda não reconheceu o fecho do circuito.</summary>
    Rastreando,
    /// <summary>Achou um re-cruzamento da própria trilha (candidato a fecho); confirmando o período.</summary>
    LinhaCandidata,
    /// <summary>Linha de chegada confirmada (2 períodos de volta consistentes) — voltas passam a fechar.</summary>
    LinhaConfirmada,
}

/// <summary>Linha de chegada APRENDIDA (mesma semântica da linha real: cruzar A–B = fronteira de volta).</summary>
public sealed record LinhaAprendida(PontoGps A, PontoGps B);

/// <summary>Um ponto da trilha decimada dentro de uma volta. DistM = distância ACUMULADA desde o
/// início da volta (o eixo do perfil velocidade × distância do CortadorTrechos).</summary>
public sealed record AmostraTrilha(PontoGps P, double Kmh, double DistM);

/// <summary>Uma volta FECHADA pelo mapeador (trilha completa entre dois cruzamentos da linha
/// aprendida). PeriodoS = duração da volta. É a unidade de entrada do CortadorTrechos.</summary>
public sealed record VoltaMapeada(IReadOnlyList<AmostraTrilha> Pontos, double PeriodoS);

/// <summary>A pista aprendida completa — o que o PistaStore persiste e o cockpit recarrega noutro
/// dia. Segmentos usam o MESMO TrechoSegmento que o TrechoDetector já consome (o detector não muda;
/// muda a ORIGEM dos segmentos). Caixa = fronteira geográfica aprendida (match de "voltei à mesma
/// pista"); PistaId = identificador estável derivado da caixa.</summary>
public sealed record PistaAprendida(
    int Versao,
    string PistaId,
    LinhaAprendida Linha,
    double LatMin, double LatMax, double LonMin, double LonMax,
    IReadOnlyList<TrechoSegmento> Segmentos);
