"""Core measurements for the Atav LeafColor baseline."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from pathlib import Path

import matplotlib.colors as mcolors
import matplotlib.pyplot as plt
import numpy as np
from PIL import Image


@dataclass(frozen=True)
class LeafColorResult:
    image_name: str
    selected_pixels: int
    valid_pixels: int
    yellowing_percent: float
    chlorosis_severity: float
    median_hue_degrees: float
    median_saturation: float
    median_brightness: float
    method: str = "Atav LeafColor baseline v0.1"

    def to_dict(self) -> dict:
        return asdict(self)


def load_rgb(path: str | Path) -> np.ndarray:
    """Load an image as an RGB float array in the range [0, 1]."""
    with Image.open(path) as image:
        return np.asarray(image.convert("RGB"), dtype=np.float32) / 255.0


def polygon_mask(shape: tuple[int, int], vertices: list[tuple[float, float]]) -> np.ndarray:
    """Return a boolean mask for an x/y polygon."""
    from matplotlib.path import Path as MplPath

    height, width = shape
    yy, xx = np.mgrid[:height, :width]
    points = np.column_stack((xx.ravel(), yy.ravel()))
    return MplPath(vertices).contains_points(points).reshape(height, width)


def analyze_leaf(rgb: np.ndarray, mask: np.ndarray, image_name: str) -> tuple[LeafColorResult, np.ndarray]:
    """Measure visible yellowing inside a user-selected leaf mask.

    This is a transparent baseline, not a biological diagnosis. Pixels that
    are extremely dark, nearly white, or weakly saturated are excluded.
    """
    if rgb.ndim != 3 or rgb.shape[2] != 3:
        raise ValueError("rgb must have shape (height, width, 3)")
    if mask.shape != rgb.shape[:2] or not np.any(mask):
        raise ValueError("mask must match the image and contain selected pixels")

    hsv = mcolors.rgb_to_hsv(np.clip(rgb, 0.0, 1.0))
    hue = hsv[..., 0] * 360.0
    saturation = hsv[..., 1]
    brightness = hsv[..., 2]

    valid = mask & (saturation >= 0.12) & (brightness >= 0.12) & (brightness <= 0.97)
    if not np.any(valid):
        raise ValueError("no usable pixels remain after quality filtering")

    # Yellow and yellow-green evidence. The range deliberately includes early
    # yellow-green transition while excluding most healthy green pixels.
    yellow = valid & (hue >= 25.0) & (hue < 95.0)

    # Continuous evidence: 0 at healthy-green boundary (95 degrees), rising
    # toward yellow (55 degrees). Saturation reduces grey/highlight influence.
    severity_map = np.clip((95.0 - hue) / 40.0, 0.0, 1.0) * saturation
    severity_map[~valid] = np.nan

    result = LeafColorResult(
        image_name=image_name,
        selected_pixels=int(mask.sum()),
        valid_pixels=int(valid.sum()),
        yellowing_percent=round(float(yellow.sum() / valid.sum() * 100.0), 2),
        chlorosis_severity=round(float(np.nanmean(severity_map) * 100.0), 2),
        median_hue_degrees=round(float(np.median(hue[valid])), 2),
        median_saturation=round(float(np.median(saturation[valid])), 4),
        median_brightness=round(float(np.median(brightness[valid])), 4),
    )
    return result, severity_map


def save_heatmap(rgb: np.ndarray, mask: np.ndarray, severity_map: np.ndarray, output: str | Path) -> None:
    """Save the selected leaf and its yellowing evidence as a PNG."""
    fig, axes = plt.subplots(1, 2, figsize=(12, 6), constrained_layout=True)
    axes[0].imshow(rgb)
    axes[0].imshow(np.where(mask, np.nan, 1.0), cmap="gray", alpha=0.55)
    axes[0].set_title("Selected leaf")
    axes[1].imshow(rgb, alpha=0.35)
    heat = axes[1].imshow(severity_map, cmap="turbo", vmin=0, vmax=1)
    axes[1].set_title("Visible yellowing evidence")
    fig.colorbar(heat, ax=axes[1], label="Evidence (0-1)")
    for axis in axes:
        axis.axis("off")
    fig.savefig(output, dpi=160)
    plt.close(fig)
