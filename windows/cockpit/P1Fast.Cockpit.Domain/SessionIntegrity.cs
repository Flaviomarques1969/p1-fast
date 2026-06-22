// SessionIntegrity — CONFERÊNCIA de uma sessão gravada (pós-pista, fora do ar).
//
// Responde a pergunta do dia de pista: "o que ficou gravado saiu inteiro?".
// Lê os registros de uma sessão (FileSessionStore.LerSessao) e devolve, só com
// número real: quantas amostras (motor/gps/evento), se a SEQUÊNCIA é contígua
// (1..N, sem pulo = nenhum registro sumiu no meio), a maior LACUNA de tempo
// (notebook dormiu/cabo caiu) e a duração. Lógica pura, testável aqui.

using System;
using System.Collections.Generic;

namespace P1Fast.Cockpit.Domain;

/// <summary>Resultado da conferência de uma sessão.</summary>
public sealed record SessionConferencia(
    string Id,
    int Total,
    int Motor,
    int Gps,
    int Eventos,
    bool SeqContigua,
    long? PrimeiraQuebraSeq,   // null = nenhuma quebra; senão a seq onde o pulo apareceu
    int Lacunas,               // buracos de tempo >= lacunaMinMs
    long MaiorLacunaMs,
    long InicioWall,
    long FimWall,
    double DuracaoS)
{
    /// <summary>Resumo legível pro operador no console.</summary>
    public string Linha =>
        $"{Id}  motor={Motor} gps={Gps} ev={Eventos}  " +
        $"seq={(SeqContigua ? "contígua" : $"QUEBRA na {PrimeiraQuebraSeq}")}  " +
        $"lacunas={Lacunas} (maior {MaiorLacunaMs} ms)  dur={DuracaoS:0.0}s";
}

public static class SessionIntegrity
{
    /// <summary>Confere a lista de registros (já na ordem de gravação = ordem de Seq).</summary>
    /// <param name="lacunaMinMs">Intervalo entre amostras a partir do qual conta como lacuna.</param>
    public static SessionConferencia Conferir(
        string id,
        IReadOnlyList<SessionRecord> regs,
        int lacunaMinMs = SessionRecorder.LacunaMinMs)
    {
        ArgumentNullException.ThrowIfNull(regs);

        int motor = 0, gps = 0, eventos = 0, lacunas = 0;
        long maiorLacuna = 0;
        long minWall = long.MaxValue, maxWall = long.MinValue;
        bool seqContigua = true;
        long? primeiraQuebra = null;
        long? wallAnterior = null;
        long esperada = 1;

        foreach (var r in regs)
        {
            switch (r.Tipo)
            {
                case "t4000": motor++; break;
                case "gps":   gps++;   break;
                case "evento": eventos++; break;
            }

            // Sequência: cada registro deveria ser o anterior + 1.
            if (seqContigua && r.Seq != esperada)
            {
                seqContigua = false;
                primeiraQuebra = r.Seq;
            }
            esperada = r.Seq + 1;

            if (r.TWall < minWall) minWall = r.TWall;
            if (r.TWall > maxWall) maxWall = r.TWall;

            if (wallAnterior is { } prev)
            {
                long delta = r.TWall - prev;
                if (delta >= lacunaMinMs)
                {
                    lacunas++;
                    if (delta > maiorLacuna) maiorLacuna = delta;
                }
            }
            wallAnterior = r.TWall;
        }

        long inicio = minWall == long.MaxValue ? 0 : minWall;
        long fim    = maxWall == long.MinValue ? 0 : maxWall;
        double durS = Math.Round((fim - inicio) / 100.0) / 10.0;

        return new SessionConferencia(
            Id: id,
            Total: regs.Count,
            Motor: motor,
            Gps: gps,
            Eventos: eventos,
            SeqContigua: seqContigua,
            PrimeiraQuebraSeq: primeiraQuebra,
            Lacunas: lacunas,
            MaiorLacunaMs: maiorLacuna,
            InicioWall: inicio,
            FimWall: fim,
            DuracaoS: durS);
    }
}
