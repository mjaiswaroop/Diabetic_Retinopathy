from app.core.config import settings

def calculate_referral_state(
    gradable: bool,
    quality_score: float,
    referable_prob: float,
    confidence: float
) -> tuple[str, str | None]:
    """
    Pure referral engine function as specified in PRD §4 / BACKEND_REQUIREMENTS §3:
    if not gradable                                  -> ungradable (no AI result)
    elif quality in borderline_band                  -> uncertain ("borderline image quality")
    elif max_calibrated_prob < uncertainty_threshold -> uncertain ("low model confidence")
    elif referable_prob >= referable_threshold       -> referable
    else                                             -> non_referable
    """
    if not gradable:
        return "ungradable", "Image is not gradable"
    
    if quality_score < settings.QUALITY_CUTOFF:
        return "uncertain", "Borderline image quality"
        
    if confidence < settings.UNCERTAINTY_THRESHOLD:
        return "uncertain", "Low model confidence (probabilities near threshold)"
        
    if referable_prob >= settings.REFERABLE_THRESHOLD:
        return "referable", None
        
    return "non_referable", None

