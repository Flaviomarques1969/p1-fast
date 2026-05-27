# P1 Fast — App Icon

## Source de verdade

- `master-upscaled-3120.png` — 3120×3120, RGBA. Master usado pra gerar todos os 18 PNGs de [`ios/p1fast-ios/Resources/Assets.xcassets/AppIcon.appiconset/`](../../ios/p1fast-ios/Resources/Assets.xcassets/AppIcon.appiconset/).
- `master-original-trimmed-780.png` — 780×780, RGBA. Source original (gerado por IA "Cloud Design"), com a margem transparente removida do PNG 1024 entregue.

## Pipeline

```
master-original-trimmed-780.png (780²)
  └─ Real-ESRGAN ncnn-vulkan (Upscayl, modelo ultrasharp-4x, scale=4)
       └─ master-upscaled-3120.png (3120²)
            └─ trim → bbox quadrado
                 └─ Lanczos 2-step downsample por size
                      └─ 18 PNGs em AppIcon.appiconset/
```

Os 18 sizes preenchem 100% do slot (97.5% no master 1024 da App Store por margem residual de 13px do bbox).

## Pra regenerar

Se o master 3120 mudar (e.g. nova versão do upscale, ou source original maior), rodar:

```bash
python3 scripts/regen-app-icon.py  # TODO: extrair de /tmp/p1-icon-extract/regen_from_upscaled.py
```

## App Store

O `Icon-AppStore-1024.png` no `.appiconset` tem canal alfa. Pra submissão na App Store
(não pra dev/TestFlight), achatar:

```bash
sips -s format png --setProperty hasAlpha no \
  ios/p1fast-ios/Resources/Assets.xcassets/AppIcon.appiconset/Icon-AppStore-1024.png \
  --out /tmp/Icon-AppStore-flat.png
```

## Histórico

- 2026-05-03: master upscaled de 780 → 3120 via Upscayl ultrasharp-4x. Substitui o tile gold gerado em `feat(1A2)` original.
