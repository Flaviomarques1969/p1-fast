// Prova da CAPTURA AUTOMÁTICA POR MOVIMENTO no .exe do notebook (port fiel do
// gravador do navegador: web/teste-aparelhos/session-recorder.js +
// tests/node-smoke-session-recorder-auto.mjs). O que o Flávio pediu em 23/06:
// a gravação começa sozinha quando o carro ANDA (entrou na pista) e para sozinha
// quando fica PARADO (box), e volta a gravar quando o carro sai de novo. O motor
// em marcha lenta no box NÃO liga nem segura a gravação — só o movimento do GPS manda.

using System.Linq;
using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class SessionRecorderAutoTests
{
    private static readonly AutoCaptura Auto = new(VOn: 15, VOff: 6, ParadoMs: 12000);

    // Relógio controlável (igual ao smoke do navegador).
    private sealed class Relogio
    {
        public double Mono;
        public long Wall = 1_700_000_000_000;
        public void Av(int ms) { Mono += ms; Wall += ms; }
    }

    private static (SessionRecorder g, Relogio r, InMemorySessionStore store) Novo()
    {
        var r = new Relogio();
        int n = 0;
        var store = new InMemorySessionStore();
        var g = new SessionRecorder(store, now: () => r.Mono, wall: () => r.Wall,
                                    gerarId: () => "S" + (++n), auto: Auto);
        return (g, r, store);
    }

    // GPS chegando com velocidade — a captura automática lê a velocidade do AmostraGps.
    private static SessionRecord? Gps(SessionRecorder g, double kmh)
        => g.Gps(new AmostraGps(-15.77, -47.89, kmh));

    private static T3000Sample Motor(int rpm) => new() { Rpm = rpm, Source = "real" };

    // 1) Carro PARADO no box não começa a gravar (nem com o motor em marcha lenta).
    [Fact]
    public void ParadoNoBox_NaoComecaAGravar()
    {
        var (g, r, store) = Novo();
        Assert.True(g.Estado().Auto);                 // 1.1 modo automático ligado
        Gps(g, 0);                                    // GPS parado (box)
        Assert.False(g.Estado().Gravando);            // 1.2 GPS parado NÃO inicia
        r.Av(200); g.Motor(Motor(1100));              // motor em marcha lenta
        Assert.False(g.Estado().Gravando);            // 1.3 motor lento NÃO inicia
        Assert.Empty(store.LerSessao("S1"));          // 1.4 nada persistido em espera (box)
    }

    // 2) Carro ANDOU (entrou na pista) => começa a gravar sozinho, motor + GPS juntos.
    [Fact]
    public void AndouNaPista_ComecaAGravar_MotorEGpsJuntos()
    {
        var (g, r, _) = Novo();
        Gps(g, 5); r.Av(200);                         // ainda devagar (< vOn)
        Assert.False(g.Estado().Gravando);            // 2.1 abaixo do limiar ainda não grava
        Gps(g, 40);                                   // acelerou => entrou na pista
        Assert.True(g.Estado().Gravando);             // 2.2 acima do limiar COMEÇA a gravar
        for (int i = 0; i < 10; i++) { r.Av(200); Gps(g, 60); g.Motor(Motor(5000)); }
        var e = g.Estado();
        Assert.True(e.Gravando);                      // 2.3 segue gravando enquanto anda
        Assert.True(e.NGps >= 10 && e.NMotor >= 10);  // 2.5 gravou GPS e motor JUNTOS
    }

    // 3) Carro PAROU no box por tempo suficiente => fecha a sessão sozinho (preservada).
    [Fact]
    public void ParouNoBox_FechaSozinho_SessaoPreservada()
    {
        var (g, r, store) = Novo();
        Gps(g, 50);                                   // andando => grava
        for (int i = 0; i < 5; i++) { r.Av(200); Gps(g, 50); }
        var idSessao = g.Estado().SessaoId!;
        Assert.True(g.Estado().Gravando);             // 3.1 gravando na pista
        // entra no box: parado, mas o GPS continua chegando (spd 0)
        for (int i = 0; i < 70; i++) { r.Av(200); Gps(g, 0); }
        Assert.False(g.Estado().Gravando);            // 3.2 parado o suficiente => FECHOU sozinho
        Assert.Equal("parado", g.MotivoUltimoFim);    // 3.3 motivo do fim = parado (box)
        var meta = store.ListarSessoes().Single(m => m.Id == idSessao);
        Assert.Equal("encerrada", meta.Status);       // 3.4 sessão preservada e encerrada
    }

    // 4) Carro SAIU de novo => abre uma NOVA sessão (uma por saída).
    [Fact]
    public void SaiuDeNovo_AbreNovaSessao()
    {
        var (g, r, store) = Novo();
        Gps(g, 50); for (int i = 0; i < 3; i++) { r.Av(200); Gps(g, 50); }  // 1ª saída
        for (int i = 0; i < 70; i++) { r.Av(200); Gps(g, 0); }             // parou no box (fecha)
        Assert.False(g.Estado().Gravando);            // 4.1 fechou a 1ª sessão
        r.Av(200); Gps(g, 45);                        // saiu de novo
        Assert.True(g.Estado().Gravando);             // 4.2 voltou a andar => NOVA gravação
        Assert.Equal(2, store.ListarSessoes().Count); // 4.3 duas sessões distintas
    }

    // 6) Fix FRACO (decisão Flávio 2026-07-11: gravar marcado): o caminho vivo passa
    //    velKmh=null pro fix<3 — ele É gravado na sessão aberta (rastro dos buracos de GPS),
    //    mas a velocidade de fix fraco NÃO abre nem segura a captura automática (o jitter
    //    de 2D "andando a 80" abriria gravação com o carro parado no box).
    [Fact]
    public void FixFraco_EGravadoNaSessaoAberta_MasNaoAbreNemSeguraACaptura()
    {
        var (g, r, _) = Novo();
        // Só fracos "a 80 km/h" (jitter): NÃO pode abrir a gravação.
        for (int i = 0; i < 5; i++) { g.Gps(new { lat = -15.77, lon = -47.89, kmh = 80.0, fix = 1 }, velKmh: null); r.Av(200); }
        Assert.False(g.Estado().Gravando);            // 6.1 fraco não abre

        Gps(g, 50);                                   // fix bom andando → abre
        Assert.True(g.Estado().Gravando);
        var antes = g.Estado().NGps;
        g.Gps(new { lat = -15.77, lon = -47.89, kmh = 0.0, fix = 1 }, velKmh: null);
        Assert.Equal(antes + 1, g.Estado().NGps);     // 6.2 fraco na sessão aberta VAI pro disco

        // Depois do bom, SÓ fracos por > ParadoMs: não seguram a sessão → fecha por parado.
        for (int i = 0; i < 70; i++) { r.Av(200); g.Gps(new { lat = -15.77, lon = -47.89, kmh = 80.0, fix = 1 }, velKmh: null); }
        Assert.False(g.Estado().Gravando);            // 6.3 fraco não segura
        Assert.Equal("parado", g.MotivoUltimoFim);
    }

    // 5) SEM o modo automático, o comportamento é o de SEMPRE (abre no 1º dado, mesmo parado).
    [Fact]
    public void SemAuto_ComportamentoDeSempre()
    {
        var r = new Relogio();
        var store = new InMemorySessionStore();
        var g = new SessionRecorder(store, now: () => r.Mono, wall: () => r.Wall);  // SEM auto
        Assert.False(g.Estado().Auto);
        g.Gps(new AmostraGps(-15.77, -47.89, 0));     // mesmo parado, abre no 1º dado
        Assert.True(g.Estado().Gravando);
    }
}
