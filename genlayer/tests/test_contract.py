import contract_mod as C


def test_derived_boolean_matches_score():
    assert C.normalize_originality_verdict({"originality_score": 75, "reasoning": "x"})["is_original"] is True
    assert C.normalize_originality_verdict({"originality_score": 40, "reasoning": "x"})["is_original"] is True
    assert C.normalize_originality_verdict({"originality_score": 39, "reasoning": "x"})["is_original"] is False
    assert C.normalize_originality_verdict({"originality_score": 0, "reasoning": "x"})["is_original"] is False


def test_normalize_clamps_out_of_range():
    assert C.normalize_originality_verdict({"originality_score": 150})["originality_score"] == 100
    assert C.normalize_originality_verdict({"originality_score": -10})["originality_score"] == 0


def test_normalize_forces_nonempty_reasoning():
    assert C.normalize_originality_verdict({"originality_score": 50})["reasoning"].strip() != ""


def test_validator_accepts_consistent():
    v = {"originality_score": 80, "is_original": True, "reasoning": "ok", "similar_sources": "none"}
    assert C.validate_originality_verdict(v) is True


def test_validator_rejects_out_of_range_scores():
    assert C.validate_originality_verdict({"originality_score": 150, "is_original": True, "reasoning": "x"}) is False
    assert C.validate_originality_verdict({"originality_score": -1, "is_original": False, "reasoning": "x"}) is False


def test_validator_rejects_inconsistent_boolean():
    assert C.validate_originality_verdict({"originality_score": 90, "is_original": False, "reasoning": "x"}) is False
    assert C.validate_originality_verdict({"originality_score": 10, "is_original": True, "reasoning": "x"}) is False


def test_validator_rejects_bad_types_and_empty_reasoning():
    assert C.validate_originality_verdict({"originality_score": "80", "is_original": True, "reasoning": "x"}) is False
    assert C.validate_originality_verdict({"originality_score": 80, "is_original": "yes", "reasoning": "x"}) is False
    assert C.validate_originality_verdict({"originality_score": True, "is_original": True, "reasoning": "x"}) is False
    assert C.validate_originality_verdict({"originality_score": 80, "is_original": True, "reasoning": ""}) is False
    assert C.validate_originality_verdict({"originality_score": 80, "is_original": True, "reasoning": "   "}) is False


def test_normalized_output_always_passes_validator():
    for s in range(-20, 130, 3):
        v = C.normalize_originality_verdict({"originality_score": s})
        assert C.validate_originality_verdict(v) is True
