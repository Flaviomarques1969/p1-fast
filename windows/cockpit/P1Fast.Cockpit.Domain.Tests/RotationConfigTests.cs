using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

/// <summary>
/// Cobertura do contrato de persistência da rotação 0°/180° por display
/// (ADR-023 amendment 6 + fixes do ultrareview da PR #166).
///
/// Bugs cobertos:
///   8 — quando o app cai pro fallback janelado (display alvo ausente),
///       a chave usada deve ser "default", não a do índice ausente.
///       Os testes (b) e (d) provam que isso isola a sessão janelada.
///   5 — não testado aqui (depende de StatusText do XAML; smoke manual no app).
/// </summary>
public class RotationConfigTests
{
    [Fact]
    public void KeyFor_DisplayValido_RetornaIndiceComoString()
    {
        Assert.Equal("2", RotationConfig.KeyFor(2));
        Assert.Equal("1", RotationConfig.KeyFor(1));
    }

    [Fact]
    public void KeyFor_DisplayNull_RetornaDefault()
    {
        Assert.Equal(RotationConfig.DefaultKey, RotationConfig.KeyFor(null));
        Assert.Equal("default", RotationConfig.KeyFor(null));
    }

    [Fact]
    public void LoadAngleFromJson_ChaveInexistente_RetornaZero()
    {
        // JSON tem só a chave "1"; pedimos a chave "default" (fallback janelado).
        // Comportamento esperado: 0° silencioso, sem exception.
        var json = "{\"1\":180}";
        Assert.Equal(0.0, RotationConfig.LoadAngleFromJson(json, displayIndex: null));

        // JSON vazio/null/inválido também → 0°.
        Assert.Equal(0.0, RotationConfig.LoadAngleFromJson(null, displayIndex: 2));
        Assert.Equal(0.0, RotationConfig.LoadAngleFromJson("", displayIndex: 2));
        Assert.Equal(0.0, RotationConfig.LoadAngleFromJson("{lixo", displayIndex: 2));
    }

    [Fact]
    public void SaveAngleToJson_AtualizaApenasChaveAlvo_PreservaOutros()
    {
        // Cenário do Bug 8: usuário tinha rotation 180° no display 2.
        // App sobe sem o display 2 enumerado (race USB-C), cai pro fallback
        // janelado, usuário aperta Ctrl+R pra rotacionar a janela.
        // Antes do fix: gravaria na chave "2" e bagunçaria a sessão futura
        //               com o display real conectado.
        // Depois do fix: grava na chave "default", display 2 fica intocado.
        var existing = "{\"2\":180}";

        var resultado = RotationConfig.SaveAngleToJson(existing, displayIndex: null, angle: 180);

        // Releitura: chave "2" deve continuar 180°, "default" agora vale 180°.
        Assert.Equal(180.0, RotationConfig.LoadAngleFromJson(resultado, displayIndex: 2));
        Assert.Equal(180.0, RotationConfig.LoadAngleFromJson(resultado, displayIndex: null));

        // E se o usuário toggle de novo no janelado (180 → 0), só "default" muda.
        var resultado2 = RotationConfig.SaveAngleToJson(resultado, displayIndex: null, angle: 0);
        Assert.Equal(180.0, RotationConfig.LoadAngleFromJson(resultado2, displayIndex: 2));
        Assert.Equal(0.0,   RotationConfig.LoadAngleFromJson(resultado2, displayIndex: null));
    }
}
