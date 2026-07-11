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
    // Linha de chegada de Brasília — fonte única em PistaBrasilia (Domain). A UI conta o
    // cruzamento AO VIVO (o Domain só conta offline, no replay), mas o valor vem de um lugar só.
    private static readonly Color VoltaAtualHaloCor = Color.FromArgb(0xFF, 0xF0, 0xC0, 0x40); // dourado (=Current/Foco)

    private int _voltaAtualIdx = -1;          // 0-based; -1 = nenhuma ainda
    private int _haloBlocoPintado = -2;        // último índice com halo pintado (-2 = nunca pintou)

    // Lap time pros recordes (Flávio 2026-07-06): uma volta = entre 2 cruzamentos consecutivos.
    private int _lapsRegistradosReplay;        // quantas voltas já entraram no armazém (replay)
    private long _ultimoCruzTickLive;          // tick do último cruzamento (live) — 0 = ainda não cruzou

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

    // Define a volta atual e repinta o halo se mudou. Item 3.5: ALÉM do plano NÃO clampa na última
    // cápsula (isso deixava a volta final com glow dourado eterno) — deixa passar pra ApplyVoltaAtualHalo,
    // que mapeia idx fora de [0, últimoBlocoReal] pro ramo -1 (nenhuma cápsula "atual"). Só o piso 0 fica.
    private void SetVoltaAtual(int idx)
    {
        var alvo = Math.Max(0, idx);
        // fronteira de volta (replay E live) = o coach:volta-fim do web: o mapa central
        // zera o rastro e re-ancora o ghost no reinício (spec do iMac 2026-07-11)
        if (alvo != _voltaAtualIdx) CoachZoomVoltaFim();
        _voltaAtualIdx = alvo;
        ApplyVoltaAtualHalo(alvo);   // dedupe/repintura ficam com ApplyVoltaAtualHalo (via _haloBlocoPintado)
    }

    // Reinício de sessão/loop: zera a volta atual e limpa o halo.
    private void ResetVoltaAtual()
    {
        _voltaAtualIdx = -1;
        _ultimoFixChegada = null;
        ApplyVoltaAtualHalo(-1);
        ResetTelaTermica();   // destrava o aquecimento e some com a tela dedicada no reinício
    }

    // Semeia _lapsRegistradosReplay (item 3.5): as voltas cujo cruzamento inicial é ANTERIOR à janela
    // do replay não são registradas. _replayCruzBase = nº de cruzamentos até (inclusive) a base da
    // janela; o 1º índice de volta a registrar é o cruzamento da base (base-1). Sem esta semente, uma
    // janela que começa no meio da sessão registraria a volta de FORA dela em _sessaoLapsMs.
    private void SemearLapsRegistrados()
        => _lapsRegistradosReplay = Math.Max(0, _replayCruzBase - 1);

    // REPLAY: volta atual = cruzamentos até o tempo da sessão, menos os anteriores à janela.
    private void AtualizarVoltaAtualReplay(double alvoMs)
    {
        if (_replayCruzamentos.Count == 0) return;
        var passados = 0;
        foreach (var c in _replayCruzamentos)
            if (c <= alvoMs) passados++;
        // Recordes: cada volta completa = entre dois cruzamentos consecutivos. Registra as novas
        // (pula as anteriores à janela de replay via _lapsRegistradosReplay, semeado por SemearLapsRegistrados).
        for (var i = _lapsRegistradosReplay; i <= passados - 2; i++)
            RegistrarVoltaCompleta(_replayCruzamentos[i + 1] - _replayCruzamentos[i]);
        if (passados - 1 > _lapsRegistradosReplay) _lapsRegistradosReplay = passados - 1;
        SetVoltaAtual(passados - _replayCruzBase);
    }

    // LIVE: cada fix; se o caminho cruzou a linha de chegada, avança uma volta.
    private void RegistrarCruzamentoLive(double lat, double lng)
    {
        var p = new PontoGps(lat, lng);
        if (_ultimoFixChegada is { } prev)
        {
            if (Math.Sign(TrechoDetector.SideOfLine(p, PistaBrasilia.ChegadaA, PistaBrasilia.ChegadaB)) != Math.Sign(TrechoDetector.SideOfLine(prev, PistaBrasilia.ChegadaA, PistaBrasilia.ChegadaB))
                && TrechoDetector.CaminhoCruzaLinha(prev, p, PistaBrasilia.ChegadaA, PistaBrasilia.ChegadaB))
            {
                // Cruzou a linha: fecha a volta. Item 3.2: uma volta conta só entre DOIS cruzamentos
                // REAIS da linha. O 1º cruzamento apenas ARMA o cronômetro (não registra) — assim o
                // trecho box→linha (sair do box e cruzar a chegada) NÃO vira uma "volta" de ~30 s.
                var tick = Environment.TickCount64;
                if (_ultimoCruzTickLive > 0) RegistrarVoltaCompleta(tick - _ultimoCruzTickLive);
                _ultimoCruzTickLive = tick;
                SetVoltaAtual((_voltaAtualIdx < 0 ? 0 : _voltaAtualIdx) + 1);
            }
        }
        else
        {
            // 1º fix válido = volta 1 na barra. NÃO arma o cronômetro aqui: a 1ª volta
            // só começa a contar no 1º cruzamento REAL da linha (item 3.2) — do contrário o trajeto
            // box→linha (que não é uma volta) entraria como recorde/média.
            SetVoltaAtual(0);
        }
        _ultimoFixChegada = p;
    }
}
