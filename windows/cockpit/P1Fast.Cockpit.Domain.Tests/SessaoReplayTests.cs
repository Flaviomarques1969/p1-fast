// SessaoReplay — loader das sessões gravadas (motor T4000 + GPS) que alimenta o replay do .exe.
// Trava dois consertos da auditoria 2026-07-09:
//   3.3 — o loader tem que ler TAMBÉM o .jsonl PascalCase do PRÓPRIO gravador do .exe
//         (antes só lia o JSON web de 21/06 com raiz "amostras"), senão as sessões de campo
//         capturadas pelo .exe não eram replayáveis.
//   3.4 — o loader aplica a MESMA guarda M3 da sonda lambda do ao vivo (fora de 0.3–1.6 ou raw 0
//         = sem dado), pra o replay não disparar MISTURA falsa que o live não daria.

using System;
using System.IO;
using System.Linq;
using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class SessaoReplayTests
{
    // ── 3.3: o .jsonl do próprio gravador do .exe é replayável ──

    [Fact]
    public void SR_01_Jsonl_do_gravador_do_exe_eh_replayavel()
    {
        var dir = Path.Combine(Path.GetTempPath(), "p1fast-replay-" + Path.GetRandomFileName());
        Directory.CreateDirectory(dir);
        var id = "sessao-teste";
        try
        {
            // Grava com o MESMO caminho de produção (FileSessionStore) → .jsonl PascalCase autêntico.
            using (var store = new FileSessionStore(dir))
            {
                store.NovaSessao(new SessionMeta(id, 1000, false, "ativa"));
                // motor: Dados = T3000Sample (PascalCase: Rpm, WaterTempC, TpsPct, Lambda…)
                store.Gravar(new SessionRecord
                {
                    SessaoId = id, Seq = 1, Tipo = "t4000", TWall = 1000, TMono = 0,
                    Dados = new T3000Sample { Rpm = 4887, WaterTempC = 70, TpsPct = 50, Lambda = 0.95, LambdaWBRaw = 1, BatteryV = 13 }
                });
                // gps: Dados = objeto anônimo lowercase, IGUAL ao OnLiveGps (lat/lon/kmh/fix/numSV/hacc)
                store.Gravar(new SessionRecord
                {
                    SessaoId = id, Seq = 2, Tipo = "gps", TWall = 1040, TMono = 40,
                    Dados = new { lat = -15.7727, lon = -47.9001, kmh = 100.0, fix = 3, numSV = 12, hacc = 10.0 }
                });
            }

            var jsonl = File.ReadAllText(Path.Combine(dir, id + ".jsonl"));
            var sessao = SessaoReplay.Carregar(jsonl);

            Assert.Equal(1, sessao.MotorCount);
            Assert.Equal(1, sessao.GpsValidos);              // fix 3 + hacc 10 + dentro de Brasília

            var motor = sessao.Eventos.First(e => e.IsMotor);
            Assert.Equal(4887, motor.Rpm);                   // wrapper PascalCase (Tipo/TWall/Dados) lido
            Assert.Equal(70, motor.Alerta!.WaterTempC);      // Dados PascalCase (WaterTempC) lido
            Assert.Equal(0.95, motor.Alerta!.Lambda);        // lambda válido preservado
        }
        finally { try { Directory.Delete(dir, true); } catch { } }
    }

    [Fact]
    public void SR_02_Formato_web_com_amostras_continua_funcionando()
    {
        // Não regride: o JSON web (raiz "amostras", camelCase) segue lido igual.
        var json = """
        { "amostras": [
            { "tipo":"t4000", "tWall":1000, "dados": { "rpm":5200, "waterTempC":68, "lambda":0.98, "lambdaWBRaw":1 } },
            { "tipo":"gps",   "tWall":1040, "dados": { "lat":-15.7727, "lon":-47.9001, "fix":3, "hacc":8 } }
          ] }
        """;
        var sessao = SessaoReplay.Carregar(json);
        Assert.Equal(1, sessao.MotorCount);
        Assert.Equal(1, sessao.GpsValidos);
        Assert.Equal(0.98, sessao.Eventos.First(e => e.IsMotor).Alerta!.Lambda);
    }

    // ── 3.4: guarda da sonda lambda no loader ──

    [Fact]
    public void SR_03_Lambda_fora_do_fisico_vira_sem_dado()
    {
        // raw 0 = sonda desconectada; 2.0 = fora do físico (0.3–1.6). Os dois viram null (sem dado),
        // pra o replay não disparar MISTURA RICA/POBRE que o ao vivo NÃO daria.
        var json = """
        { "amostras": [
            { "tipo":"t4000", "tWall":1000, "dados": { "rpm":5000, "lambda":0.0, "lambdaWBRaw":0 } },
            { "tipo":"t4000", "tWall":1040, "dados": { "rpm":5000, "lambda":2.0 } },
            { "tipo":"t4000", "tWall":1080, "dados": { "rpm":5000, "lambda":0.95, "lambdaWBRaw":1 } }
          ] }
        """;
        var motores = SessaoReplay.Carregar(json).Eventos.Where(e => e.IsMotor).ToList();
        Assert.Equal(3, motores.Count);
        Assert.Null(motores[0].Alerta!.Lambda);   // sonda desconectada (raw 0)
        Assert.Null(motores[1].Alerta!.Lambda);   // 2.0 fora do físico
        Assert.Equal(0.95, motores[2].Alerta!.Lambda); // válido: passa
    }

    [Fact]
    public void SR_04_Linha_corrompida_no_jsonl_nao_derruba_o_resto()
    {
        // Queda no meio de uma escrita deixa uma linha quebrada — o loader pula e lê o resto.
        var jsonl =
            "{ \"Tipo\":\"t4000\", \"TWall\":1000, \"Dados\": { \"Rpm\":4000, \"Lambda\":0.9, \"LambdaWBRaw\":1 } }\n" +
            "{ \"Tipo\":\"t4000\", \"TWall\":1040, \"Dados\": { \"Rpm\": \n" +   // linha truncada
            "{ \"Tipo\":\"t4000\", \"TWall\":1080, \"Dados\": { \"Rpm\":4200, \"Lambda\":0.9, \"LambdaWBRaw\":1 } }\n";
        var sessao = SessaoReplay.Carregar(jsonl);
        Assert.Equal(2, sessao.MotorCount);   // as 2 linhas íntegras entram; a truncada é pulada
    }
}
