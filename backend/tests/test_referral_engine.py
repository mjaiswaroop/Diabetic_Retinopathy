from app.services.referral_engine import calculate_referral_state

def test_referral_engine_ungradable():
    state, reason = calculate_referral_state(
        gradable=False,
        quality_score=0.35,
        referable_prob=0.85,
        confidence=0.9
    )
    assert state == "ungradable"
    assert "not gradable" in reason

def test_referral_engine_uncertain_due_to_quality():
    state, reason = calculate_referral_state(
        gradable=True,
        quality_score=0.55,  # below default 0.60
        referable_prob=0.85,
        confidence=0.9
    )
    assert state == "uncertain"
    assert "quality" in reason.lower()

def test_referral_engine_uncertain_due_to_confidence():
    state, reason = calculate_referral_state(
        gradable=True,
        quality_score=0.85,
        referable_prob=0.52,
        confidence=0.58  # below default 0.65
    )
    assert state == "uncertain"
    assert "confidence" in reason.lower()

def test_referral_engine_referable():
    state, reason = calculate_referral_state(
        gradable=True,
        quality_score=0.85,
        referable_prob=0.78,
        confidence=0.90
    )
    assert state == "referable"
    assert reason is None

def test_referral_engine_non_referable():
    state, reason = calculate_referral_state(
        gradable=True,
        quality_score=0.85,
        referable_prob=0.15,
        confidence=0.92
    )
    assert state == "non_referable"
    assert reason is None

