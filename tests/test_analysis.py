import numpy as np

from atav_leafcolor import analyze_leaf


def test_yellow_image_scores_higher_than_green_image():
    mask = np.ones((20, 20), dtype=bool)
    green = np.full((20, 20, 3), [0.15, 0.65, 0.18], dtype=np.float32)
    yellow = np.full((20, 20, 3), [0.75, 0.68, 0.12], dtype=np.float32)

    green_result, _ = analyze_leaf(green, mask, "green.png")
    yellow_result, _ = analyze_leaf(yellow, mask, "yellow.png")

    assert yellow_result.yellowing_percent > green_result.yellowing_percent
    assert yellow_result.chlorosis_severity > green_result.chlorosis_severity
