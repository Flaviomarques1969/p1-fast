// MainWindow.VoltaAtual.cs — Etapa 4 da barra de voltas (Flávio 2026-07-05, visual "A" aprovado).
//
// A barra do topo mostra o PLANO do stint (cor por tipo de volta — etapas 1-3). A etapa 4 a
// torna REATIVA: conforme o piloto cruza a linha de chegada, a VOLTA ATUAL ganha um HALO
// dourado (contorno), separando "feita / atual / a-fazer". Decisão visual do Flávio (opção A):
// só a volta atual se destaca; feitas e a-fazer ficam na cor do tipo. É ADITIVO — só acrescenta
// BorderBrush/BorderThickness nos Borders que já existem; NÃO muda o layout nem as cores do plano.
//
// Volta atual:
//   • REPLAY: conta os cruzamentos gravados da sessão (SessaoReplay.CruzamentosMs) até o tempo atual.
//   • LIVE:   conta os cruzamentos da linha de chegada no fluxo de GPS (mesma geometria do replay).
// O dourado é o mesmo "Current"/Foco que já existe no cockpit (#F0C040).

using System;
using System.Collections.Generic;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Media;
using Windows.UI;
using P1Fast.Cockpit.Domain;

namespace P1Fast.Cockpit.UI;

public sealed partial class MainWindow
{
    // Linha de chegada de Brasília — MESMOS pontos de SessaoReplay (fronteira de volta). Duplicado
    // aqui porque a UI conta o cruzamento AO VIVO (o Domain só conta offline, no replay).
    private static readonly PontoGps ChegadaA = new(-15.7728816, -47.9000707);
    private static readonly PontoGps ChegadaB = new(-15.7725493, -47.9001926);
    private static readonly Color VoltaAtualHaloCor = Color.FromArgb(0xFF, 0xF0, 0xC0, 0x40); // dourado (=Current/Foco)

    private int _voltaAtualIdx = -1;          // 0-based; -1 = nenhuma ainda
    private int _haloBlocoPintado = -2;        // último índice com halo pintado (-2 = nunca pintou)

    // Replay: cruzamentos da sessão + quantos já tinham passado ANTES da janela de replay.
    private IReadOnlyList<double> _replayCruzamentos = Array.Empty<double>();
    private int _replayCruzBase;

    // Live: último fix pra achar a transição de lado da linha de chegada.
    private PontoGps? _ultimoFixChegada;

    // Índice do ÚLTIMO bloco que é volta de verdade (não Pending) — o halo nunca passa disto.
    private int UltimoBlocoReal()
    {
        var plano = _planoStintReal ?? PlanoStintPlaceholder;
        var last = -1;
        for (var i = 0; i < _stintBlocks.Length && i < plano.Length; i++)
            if (plano[i] != StintBlockState.Pending) last = i;
        return last;
    }

    // Define a volta atual (clampeada ao plano) e repinta a barra se mudou. Direção C: a atual fica
    // dourada com glow (RepintarBarra em MainWindow.BarraVoltas.cs) — não é mais só um contorno.
    // alvo fora de [0, últimoBlocoReal] → nenhuma volta em curso (antes de começar / além do plano).
    private void ApplyVoltaAtualHalo(int idx)
    {
        if (_stintBlocks.Length == 0) return;
        var lastReal = UltimoBlocoReal();
        var alvo = (idx >= 0 && idx <= lastReal) ? idx : -1;
        if (alvo == _haloBlocoPintado) return;   // nada mudou → não repinta
        _haloBlocoPintado = alvo;
        _voltaAtualRender = alvo;
        RepintarBarra();
    }

    // Define a volta atual (clamped ao plano) e repinta o halo se mudou.
    private void SetVoltaAtual(int idx)
    {
        var lastReal = UltimoBlocoReal();
        var clamped = Math.Clamp(idx, 0, Math.Max(0, lastReal));
        if (clamped == _voltaAtualIdx && _haloBlocoPintado == clamped) return;
        _voltaAtualIdx = clamped;
        ApplyVoltaAtualHalo(clamped);
    }

    // Reinício de sessão/loop: zera a volta atual e limpa o halo.
    private void ResetVoltaAtual()
    {
        _voltaAtualIdx = -1;
        _ultimoFixChegada = null;
        ApplyVoltaAtualHalo(-1);
        ResetTelaTermica();   // destrava o aquecimento e some com a tela dedicada no reinício
    }

    // REPLAY: volta atual = cruzamentos até o tempo da sessão, menos os anteriores à janela.
    private void AtualizarVoltaAtualReplay(double alvoMs)
    {
        if (_replayCruzamentos.Count == 0) return;
        var passados = 0;
        foreach (var c in _replayCruzamentos)
            if (c <= alvoMs) passados++;
        SetVoltaAtual(passados - _replayCruzBase);
    }

    // LIVE: cada fix; se o caminho cruzou a linha de chegada, avança uma volta.
    private void RegistrarCruzamentoLive(double lat, double lng)
    {
        var p = new PontoGps(lat, lng);
        if (_ultimoFixChegada is { } prev)
        {
            if (Math.Sign(TrechoDetector.SideOfLine(p, ChegadaA, ChegadaB)) != Math.Sign(TrechoDetector.SideOfLine(prev, ChegadaA, ChegadaB))
                && TrechoDetector.CaminhoCruzaLinha(prev, p, ChegadaA, ChegadaB))
                SetVoltaAtual((_voltaAtualIdx < 0 ? 0 : _voltaAtualIdx) + 1);
        }
        else
        {
            SetVoltaAtual(0);   // 1º fix válido = volta 1 (aquecimento)
        }
        _ultimoFixChegada = p;
    }
}
