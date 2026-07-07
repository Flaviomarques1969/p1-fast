// Prep do acelerômetro do RaceBox (Flávio 2026-07-07): o filtro de GPS só ATRAVESSA a aceleração
// crua (g) até o AmostraGps — pro dia de bancada calibrar o eixo e ligar a confirmação de troca.
// O cérebro ainda NÃO usa; aqui só garantimos que o dado não some no caminho.

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class GpsFiltroAccelTests
{
    [Fact]
    public void GFA_accel_atravessa_o_filtro_ate_a_amostra()
    {
        var f = new GpsFiltroAoVivo();
        var a = f.Aceitar(-15.77, -47.90, fix: 3, hacc: 10, tWall: 1000, headingDeg: null,
            ax: 0.12, ay: -0.34, az: 0.98); // dentro da caixa de Brasília, qualidade ok
        Assert.NotNull(a);
        Assert.Equal(0.12, a!.AccelXg);
        Assert.Equal(-0.34, a.AccelYg);
        Assert.Equal(0.98, a.AccelZg);
    }

    [Fact]
    public void GFA_sem_accel_fica_null_nao_zero()
    {
        var f = new GpsFiltroAoVivo();
        var a = f.Aceitar(-15.77, -47.90, fix: 3, hacc: 10, tWall: 1000);
        Assert.NotNull(a);
        Assert.Null(a!.AccelXg);
        Assert.Null(a.AccelYg);
        Assert.Null(a.AccelZg);
    }
}
