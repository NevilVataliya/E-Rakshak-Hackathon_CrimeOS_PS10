"""
Quick functional test for the centralized error-handling policy (error_policy.py).
Verifies:
  - Retry logic on transient/429 errors (with retryable detection)
  - Fallback policy returns the fallback result
  - Abort policy raises ErrorPolicyError
  - Retry delay calculation (exponential backoff with cap)
  - MAX_RETRY_WAIT_SEC wait-budget cap ("only retry if the retry time is small")
"""
import os
import sys

# Ensure ai-service root is on path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.utils.error_policy import (
    with_retry,
    handle_llm_error,
    is_retryable_error,
    get_retry_delay,
    get_policy_summary,
    should_fallback,
)


def test_retryable_detection():
    assert is_retryable_error(Exception("rate_limit_exceeded 429")) is True
    assert is_retryable_error(Exception("429 You have exceeded your quota")) is True
    assert is_retryable_error(Exception("connection timed out")) is True
    assert is_retryable_error(Exception("internal server error 500")) is True
    assert is_retryable_error(Exception("invalid JSON")) is False
    print("  [OK] is_retryable_error detection")


def test_retry_logic():
    calls = {"n": 0}

    def flaky():
        calls["n"] += 1
        if calls["n"] < 3:
            raise Exception("rate_limit_exceeded 429")
        return "SUCCESS"

    result = with_retry(flaky, max_retries=3)
    assert result == "SUCCESS"
    assert calls["n"] == 3
    print("  [OK] with_retry succeeded after 2 retries (3 calls)")


def test_retry_exhaustion():
    calls = {"n": 0}

    def always_fail():
        calls["n"] += 1
        raise Exception("429 rate limit")

    try:
        with_retry(always_fail, max_retries=2)
        assert False, "Should have raised"
    except Exception as e:
        assert "429" in str(e)
        assert calls["n"] == 3  # initial + 2 retries
    print("  [OK] with_retry raised after exhausting retries")


def test_retry_delay_calc():
    import app.utils.error_policy as ep
    base = ep.RETRY_BASE_DELAY
    cap = ep.RETRY_MAX_DELAY
    # attempt 1: base * 2^0, jittered ±20% → between 0.8*base and cap
    d1 = get_retry_delay(1)
    # attempt 5: base * 2^4 = 16x base, capped at RETRY_MAX_DELAY
    d5 = get_retry_delay(5)
    # Allow small floating-point / jitter tolerance at the lower bound.
    assert d1 >= base * 0.79 - 1e-9, f"d1={d1} below lower bound"
    assert d1 <= cap + 1e-9, f"d1={d1} above cap"
    assert d5 <= cap + 1e-9, f"d5={d5} above cap"
    assert d5 >= base - 1e-9, f"d5={d5} below base"
    print(f"  [OK] get_retry_delay exponential backoff with cap (d1={d1}, d5={d5})")


def test_wait_budget_cap():
    """MAX_RETRY_WAIT_SEC stops retrying when the next delay would exceed budget."""
    import app.utils.error_policy as ep
    old_wait = ep.MAX_RETRY_WAIT_SEC
    ep.MAX_RETRY_WAIT_SEC = 0.0001  # tiny budget -> retries skipped immediately
    calls = {"n": 0}

    def always_fail():
        calls["n"] += 1
        raise Exception("429 rate limit")

    try:
        with_retry(always_fail, max_retries=3)
        assert False, "Should have raised"
    except Exception as e:
        assert "429" in str(e)
        assert calls["n"] == 1, f"Should only attempt once (budget cap), got {calls['n']}"
    ep.MAX_RETRY_WAIT_SEC = old_wait
    print("  [OK] MAX_RETRY_WAIT_SEC cap skips retries when wait budget is tiny")


def test_fallback_policy():
    def fallback_func():
        return {"mode": "FALLBACK_RESULT"}

    result = handle_llm_error(Exception("429 rate limit"), context="test", fallback_func=fallback_func)
    assert result == {"mode": "FALLBACK_RESULT"}
    print("  [OK] fallback policy returned fallback result")


def test_abort_policy():
    os.environ["ERROR_POLICY"] = "abort"
    import importlib
    import app.utils.error_policy as ep
    importlib.reload(ep)

    def fallback_func():
        return {"mode": "FALLBACK_RESULT"}

    try:
        ep.handle_llm_error(Exception("boom"), context="test", fallback_func=fallback_func)
        assert False, "Should have raised ErrorPolicyError"
    except ep.ErrorPolicyError as e:
        assert "boom" in str(e)
    print("  [OK] abort policy raised ErrorPolicyError")

    # Restore default
    os.environ["ERROR_POLICY"] = "fallback"
    importlib.reload(ep)


if __name__ == "__main__":
    print("\n=== ERROR POLICY FUNCTIONAL TESTS ===")
    print(f"Default summary: {get_policy_summary()}")
    print(f"should_fallback() = {should_fallback()}")
    print()
    test_retryable_detection()
    test_retry_logic()
    test_retry_exhaustion()
    test_retry_delay_calc()
    test_wait_budget_cap()
    test_fallback_policy()
    test_abort_policy()
    print("\nALL TESTS PASSED")

