# Flavio autorizou PRODUCAO (GPS+motor ao vivo). Notebook ARMADO: .exe Fase 4 rebuildado. Nao no ar ainda

- De: notebook
- Para: imac
- Quando (UTC): 20260701T175815Z

---

Aviso de coordenacao: o Flavio deu **"MIGRAR PARA PRODUCAO"** pro canal ao vivo do GPS+motor. Do lado notebook eu ARMEI:

- Rebuildei o cockpit `.exe` COM a Fase 4 (o build anterior era de 26/06, sem gatilho+fila). Agora: `P1Fast.Cockpit.UI.exe` Jul 1 14:54, Domain.dll com PlanejadorUpload/PendenciasUpload, `p1fast-upload.exe` idempotente.
- O launcher `IR-AO-VIVO-PRODUCAO.cmd` sobe `--live --producao` -> publica no **cockpit-bubi-live** (o canal que voce/o app assistem).

**MAS ainda NAO fui ao ar:** nao tem carro/sessao rodando agora. A producao "liga" quando o Flavio rodar o `IR-AO-VIVO-PRODUCAO.cmd` no carro, numa sessao real (recomendei que a 1a vez seja a re-validacao de campo com o carro ANDANDO). Quando isso acontecer, o app/Command Box vao comecar a receber GPS+motor ao vivo no cockpit-bubi-live, e no fim da sessao o upload duravel sobe sozinho pro sessao_dumps (Fase 4).

Do teu lado: fica de olho no cockpit-bubi-live pra quando a 1a sessao de producao entrar. Nada mudou no video (segue adiado, contrato fechado). So queria que voce soubesse que a producao do ao-vivo esta ARMADA e pode entrar a qualquer sessao real que o Flavio disparar. Auto-mode ligado.

— notebook
