import cv2
import numpy as np

MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)

def crop_fov(bgr: np.ndarray, is_20d: bool = False, target_size: int = 384):
    """
    Single Canonical Preprocessing & Retinal Aperture Cropper.
    Robust against any aspect ratio, letterboxing, or wide black padding.
    Extracts the circular retinal foreground, square zero-pads without distortion,
    and resizes to (target_size, target_size).
    """
    h, w = bgr.shape[:2]
    total_area = float(h * w)
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    
    # Threshold at 10 to capture valid retina while rejecting pure/near-black borders
    _, thresh = cv2.threshold(gray, 10, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    valid_c = None
    if contours:
        # Sort contours by area descending
        contours = sorted(contours, key=cv2.contourArea, reverse=True)
        for c in contours:
            area = cv2.contourArea(c)
            # Area must be at least 2% of total canvas
            if area >= 0.02 * total_area:
                perimeter = cv2.arcLength(c, True)
                if perimeter > 0:
                    circularity = (4.0 * np.pi * area) / (perimeter ** 2)
                    if circularity > 0.35:
                        valid_c = c
                        break
        # Fallback to largest contour if none met circularity threshold
        if valid_c is None and len(contours) > 0 and cv2.contourArea(contours[0]) >= 0.02 * total_area:
            valid_c = contours[0]
            
    if valid_c is not None:
        (cx, cy), radius = cv2.minEnclosingCircle(valid_c)
        r = int(radius)
        cx, cy = int(cx), int(cy)
        
        # Bounding square around retina
        x1, y1 = cx - r, cy - r
        x2, y2 = cx + r, cy + r
        
        pad_left = max(0, -x1)
        pad_top = max(0, -y1)
        pad_right = max(0, x2 - w)
        pad_bottom = max(0, y2 - h)
        
        if pad_left > 0 or pad_top > 0 or pad_right > 0 or pad_bottom > 0:
            padded = cv2.copyMakeBorder(
                bgr, pad_top, pad_bottom, pad_left, pad_right, cv2.BORDER_CONSTANT, value=[0, 0, 0]
            )
            cropped = padded[y1 + pad_top : y2 + pad_top, x1 + pad_left : x2 + pad_left]
        else:
            cropped = bgr[y1:y2, x1:x2]
            
        mask = np.zeros((cropped.shape[0], cropped.shape[1]), dtype=np.uint8)
        cv2.circle(mask, (cropped.shape[1] // 2, cropped.shape[0] // 2), cropped.shape[1] // 2, 255, -1)
    else:
        cropped = bgr
        mask = np.ones((h, w), dtype=np.uint8) * 255
        
    crop_resized = cv2.resize(cropped, (target_size, target_size), interpolation=cv2.INTER_AREA)
    mask_resized = cv2.resize(mask, (target_size, target_size), interpolation=cv2.INTER_NEAREST)
    
    if is_20d:
        crop_resized = cv2.rotate(crop_resized, cv2.ROTATE_180)
        mask_resized = cv2.rotate(mask_resized, cv2.ROTATE_180)
        
    return crop_resized, mask_resized


def assess_image_quality(crop_bgr: np.ndarray, mask: np.ndarray) -> dict:
    """
    Deterministic Image Quality Assessment (IQA) gate evaluated strictly
    on pixels INSIDE the cropped circular retinal mask:
    - Retinal Area check: ensures minimum diagnostic tissue presence.
    - Underexposure check: mean luminance in retinal mask >= 18.0.
    - Overexposure / Glare check: saturated pixels (> 245) <= 10.0%.
    - Blur check: Laplacian variance on green channel in retinal mask >= 20.0.
    """
    retina_px_count = int(np.sum(mask > 0))
    if retina_px_count < 1000:
        return {
            "gradable": False,
            "reason": "Retinal field of view (FOV) could not be detected. Ensure the pupil is properly aligned."
        }
        
    gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
    retina_gray = gray[mask > 0]
    
    # 1. Underexposure check
    mean_lum = float(np.mean(retina_gray))
    if mean_lum < 18.0:
        return {
            "gradable": False,
            "reason": f"Severe underexposure (mean illumination {mean_lum:.1f}/255 < 18.0). Increase camera illumination or dilate pupil."
        }
        
    # 2. Overexposure / Glare check
    glare_pct = float(np.mean(retina_gray > 245) * 100.0)
    if glare_pct > 10.0:
        return {
            "gradable": False,
            "reason": f"Excessive glare/overexposure ({glare_pct:.1f}% saturated pixels in FOV > 10.0%). Reposition light reflex or eliminate external reflections."
        }
        
    # 3. Blur check (Laplacian variance on Green channel in FOV)
    green = crop_bgr[:, :, 1]
    laplacian = cv2.Laplacian(green, cv2.CV_64F)
    lap_var = float(np.var(laplacian[mask > 0]))
    if lap_var < 14.0:
        return {
            "gradable": False,
            "reason": f"High motion blur or optical defocus (sharpness index {lap_var:.1f} < 14.0). Ask patient to fixate on the internal target and refocus."
        }
        
    return {
        "gradable": True,
        "reason": "Adequate diagnostic quality",
        "sharpness": lap_var,
        "mean_lum": mean_lum,
        "glare_pct": glare_pct
    }

