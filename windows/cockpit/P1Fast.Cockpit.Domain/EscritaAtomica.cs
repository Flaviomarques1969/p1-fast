// EscritaAtomica — grava um arquivo pequeno À PROVA DE QUEDA DE ENERGIA (2026-07-09).
//
// Documento pequeno e reescrito no lugar (meta.json da sessão, snapshots de
// aprendizado/luz de marcha) NÃO pode usar File.WriteAllText direto: uma queda de
// energia no meio da escrita trunca o arquivo e a informação íntegra some em
// silêncio (o meta truncado some da fila de upload pra sempre; o carro "esquece" o
// aprendizado). O padrão certo já existia no repo (RecordesStore.Salvar): grava num
// .tmp, força o disco (fsync) e renomeia por cima (rename é atômico no NTFS) — uma
// queda no meio deixa OU o arquivo antigo intacto OU o novo completo, nunca um
// meio-arquivo. Este helper extrai esse padrão pra os quatro pontos usarem a MESMA
// garantia (SessionRecorder.NovaSessao/Finalizar, MainWindow.Aprendizado, MainWindow.LuzMarcha).

using System.IO;

namespace P1Fast.Cockpit.Domain;

public static class EscritaAtomica
{
    /// <summary>Escreve <paramref name="conteudo"/> em <paramref name="caminho"/> de forma
    /// atômica: grava um .tmp ao lado, força o disco físico (fsync) e renomeia por cima.
    /// Uma queda de energia no meio nunca deixa um arquivo pela metade no lugar do bom.</summary>
    public static void WriteAllText(string caminho, string conteudo)
    {
        var tmp = caminho + ".tmp";

        // .tmp com fsync → o conteúdo novo está inteiro no disco ANTES do rename.
        using (var fs = new FileStream(tmp, FileMode.Create, FileAccess.Write, FileShare.None))
        using (var w = new StreamWriter(fs))
        {
            w.Write(conteudo);
            w.Flush();
            try { fs.Flush(flushToDisk: true); } catch { /* já no SO */ }
        }
        // rename atômico por cima (NTFS): nunca deixa meio-arquivo no lugar do bom.
        File.Move(tmp, caminho, overwrite: true);
    }
}
