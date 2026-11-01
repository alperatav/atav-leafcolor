# Atav LeafColor 🌱🔬

Atav LeafColor is an offline, open-source research prototype for measuring visible leaf yellowing from digital images under varying lighting conditions.

## Research goal

The project investigates whether reference-aware color normalization and stability analysis can improve the reliability of visible leaf chlorosis measurements across lighting conditions.

The current `v0.1` implementation is a transparent HSV-based baseline. It measures color inside a leaf outline selected by the user. It does **not** diagnose a disease or nutrient deficiency.

## Two local ways to run

### 1. Local Chrome — phone or PC

1. Download this repository as a ZIP and extract it.
2. Open `web/index.html` in Chrome.
3. Choose a leaf image.
4. Tap or click around one leaf with at least three points.
5. Select **Analyze leaf**.

The browser version is fully local: the selected image is not uploaded anywhere and no API is used.

### 2. Local Python — PC research workflow

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py path/to/leaf.jpg
```

On Windows, activate the environment with `.venv\Scripts\activate`.

Click around one leaf in the opened window and press Enter. The program writes a JSON report and a heatmap into `results/`.

## Current outputs

- Visible yellowing percentage
- Weighted chlorosis severity score
- Median hue, saturation, and brightness
- Yellowing evidence heatmap
- Reproducible JSON report

## Important scientific limitation

Version `v0.1` is the baseline used to build the experimental pipeline. Fixed thresholds may change under different illumination and cameras. Color-reference normalization, repeatability testing, and threshold validation are planned research stages rather than completed claims.

## Privacy

All image processing is performed locally. No API, cloud model, analytics service, or external server is used.

## License

Apache License 2.0
