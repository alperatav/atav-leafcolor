"""Interactive desktop entry point for Atav LeafColor."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import matplotlib.pyplot as plt
from matplotlib.widgets import PolygonSelector

from atav_leafcolor import analyze_leaf, load_rgb, polygon_mask, save_heatmap


def choose_polygon(rgb):
    vertices = []
    fig, axis = plt.subplots(figsize=(9, 7))
    axis.imshow(rgb)
    axis.set_title("Click around ONE leaf, then press Enter")
    axis.axis("off")

    def selected(points):
        vertices[:] = points
        axis.set_title("Selection captured — close this window to analyze")
        fig.canvas.draw_idle()

    selector = PolygonSelector(axis, selected, useblit=True)
    plt.show()
    selector.disconnect_events()
    if len(vertices) < 3:
        raise SystemExit("No polygon selected. Run again and mark at least 3 points.")
    return vertices


def main() -> None:
    parser = argparse.ArgumentParser(description="Measure visible leaf yellowing offline.")
    parser.add_argument("image", help="Path to a JPG or PNG image")
    parser.add_argument("--output", default="results", help="Output directory")
    args = parser.parse_args()

    image_path = Path(args.image)
    output_dir = Path(args.output)
    output_dir.mkdir(parents=True, exist_ok=True)

    rgb = load_rgb(image_path)
    vertices = choose_polygon(rgb)
    mask = polygon_mask(rgb.shape[:2], vertices)
    result, severity_map = analyze_leaf(rgb, mask, image_path.name)

    stem = image_path.stem
    report_path = output_dir / f"{stem}_report.json"
    heatmap_path = output_dir / f"{stem}_heatmap.png"
    report_path.write_text(json.dumps(result.to_dict(), indent=2), encoding="utf-8")
    save_heatmap(rgb, mask, severity_map, heatmap_path)

    print(json.dumps(result.to_dict(), indent=2))
    print(f"Report: {report_path}")
    print(f"Heatmap: {heatmap_path}")


if __name__ == "__main__":
    main()
