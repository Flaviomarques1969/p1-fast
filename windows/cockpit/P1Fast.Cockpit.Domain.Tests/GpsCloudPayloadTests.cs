// GpsCloudPayload: o payload do evento "gps" tem que bater 1:1 com o
// cloudSend('gps', …) da página web (web/teste-aparelhos/index.html ~L500).

using P1Fast.Cockpit.Domain;
using Xunit;

namespace P1Fast.Cockpit.Domain.Tests;

public class GpsCloudPayloadTests
{
    [Fact]
    public void Mapeia_campos_no_shape_da_pagina_web()
    {
        var s = new RaceBoxGpsSample(Fix: 3, NumSV: 9, HAccM: 2.5, SpeedKmh: 142.7, Lat: -15.7795, Lon: -47.9297);
        var p = GpsCloudPayload.Build(s, tWallMs: 1_777_000_000_000);

        Assert.Equal(-15.7795, (double)p["lat"]!, 4);
        Assert.Equal(-47.9297, (double)p["lng"]!, 4);   // longitude vai em "lng"
        Assert.Equal(142.7, (double)p["kmh"]!, 1);
        Assert.Equal(9, (int)p["numSV"]!);
        Assert.Equal(3, (int)p["fix"]!);
        Assert.Equal(2.5, (double)p["accM"]!, 3);
        Assert.Equal(1_777_000_000_000L, (long)p["tWall"]!);
    }

    [Fact]
    public void Chaves_sao_exatamente_as_esperadas()
    {
        var s = new RaceBoxGpsSample(Fix: 0, NumSV: 0, HAccM: 0, SpeedKmh: 0, Lat: 0, Lon: 0);
        var p = GpsCloudPayload.Build(s, tWallMs: 0);

        var esperadas = new[] { "lat", "lng", "kmh", "numSV", "fix", "accM", "tWall" };
        Assert.Equal(esperadas.Length, p.Count);
        foreach (var k in esperadas) Assert.True(p.ContainsKey(k), $"falta a chave {k}");
    }

    [Fact]
    public void Evento_eh_gps()
    {
        Assert.Equal("gps", GpsCloudPayload.Event);
    }

    [Fact]
    public void Sample_nulo_lanca()
    {
        Assert.Throws<System.ArgumentNullException>(() => GpsCloudPayload.Build(null!, 0));
    }
}
