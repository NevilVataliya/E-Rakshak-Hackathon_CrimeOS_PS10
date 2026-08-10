"""
CrimeOS AI — Centralized Error Handling Policy
===============================================
Provides a configurable policy for handling LLM API errors (rate limits, timeouts,
server errors) across the entire CrimeOS pipeline.

Policy Modes (controlled via ERROR_POLICY env var):
  - "fallback" (default): On LLM error, fall back to the heuristic/local extractor
                          and continue processing (graceful degradation).
  - "abort":              On LLM error, raise the exception and end the process
                          (fail-fast). No silent fallback.

Retry Configuration (controlled via env vars):
  - MAX_RETRIES:          Max number of retry attempts after the initial failure.
  - RETRY_BASE_DELAY:     Base delay in seconds for the first retry.
  - RETRY_MAX_DELAY:      Maximum delay in seconds (cap for exponential backoff).
  - RETRY_BACKOFF_FACTOR: Multiplier applied to the delay after each retry.
"""

import os
import re
import time
import random
from typing import Any, Callable, Dict, Optional, TypeVar

T = TypeVar("T")

# ─── Policy Configuration (loaded from env) ─────────────────────────────────

ERROR_POLICY = os.getenv("ERROR_POLICY", "fallback").lower()  # "fallback" | "abort"
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))
RETRY_BASE_DELAY = float(os.getenv("RETRY_BASE_DELAY", "5"))
RETRY_MAX_DELAY = float(os.getenv("RETRY_MAX_DELAY", "60"))
RETRY_BACKOFF_FACTOR = float(os.getenv("RETRY_BACKOFF_FACTOR", "2.0"))
# Maximum TOTAL time (seconds) we are willing to spend retrying. If the computed
# backoff delay for the next attempt would push the total retry wait beyond this
# cap, we skip the retry and go straight to fallback/abort. This implements the
# "retry only if the retry time is small" requirement — don't waste minutes
# sleeping when a fallback is available. Set to 0 to disable retries entirely.
MAX_RETRY_WAIT_SEC = float(os.getenv("MAX_RETRY_WAIT_SEC", "300"))
# If a rate-limit response tells us to retry after some time, only retry if that
# wait is <= this threshold (seconds). Groq/OpenAI/Anthropic return retry-after
# hints in the error message (e.g. "Please try again in 2h9m16.128s"). If the
# provider needs us to wait longer than this, we fail fast instead of sleeping.
MAX_RATE_LIMIT_WAIT_SEC = float(os.getenv("MAX_RATE_LIMIT_WAIT_SEC", "300"))  # 5 minutes


# ─── Rate-Limit / Retryable Error Detection ─────────────────────────────────

def parse_rate_limit_retry_after(exc: BaseException) -> float:
    """
    Parse the retry-after hint from a rate-limit exception message.

    Groq (and OpenAI/Anthropic) return messages like:
      "Please try again in 2h9m16.128s ..."
      "Rate limit reached ... try again in 1h5m11.328s ..."
      "Please try again in 29.392s ..."

    Returns:
        The retry delay in seconds, or 0.0 if no explicit retry time is present.
    """
    err_str = str(exc)
    # Match patterns like "2h9m16.128s", "1h5m11s", "29.392s", "5m", "2h"
    m = re.search(r"in\s+(\d+(?:\.\d+)?)\s*(h|m|s)?(?:\s*(\d+(?:\.\d+)?)\s*(m|s))?(?:\s*(\d+(?:\.\d+)?)\s*s)?", err_str, re.IGNORECASE)
    if not m:
        return 0.0
    total = 0.0
    # First component
    val1 = float(m.group(1))
    unit1 = (m.group(2) or 's').lower()
    if unit1 == 'h':
        total += val1 * 3600
    elif unit1 == 'm':
        total += val1 * 60
    else:
        total += val1
    # Second component (minutes or seconds)
    if m.group(3):
        val2 = float(m.group(3))
        unit2 = (m.group(4) or 's').lower()
        if unit2 == 'm':
            total += val2 * 60
        else:
            total += val2
    # Third component (seconds)
    if m.group(5):
        total += float(m.group(5))
    return total


def is_retryable_error(exc: BaseException) -> bool:
    """
    Determine whether an exception is retryable (rate limit, transient network,
    or server error). Returns True if the error is transient and a retry may help.

    IMPORTANT: A hard `TimeoutError` raised by our own LLM call wrapper
    (`_invoke_llm_with_timeout`) is NOT retryable. The timeout means the provider
    is unreachable/slow and retrying would only compound the wait. We must fail
    fast and trigger the heuristic fallback instead. (Langchain's own transient
    exceptions are caught separately — this only applies to the hard timeout.)

    RATE-LIMIT TIME-AWARENESS:
    For rate-limit errors (429), we parse the provider's retry-after hint. If the
    provider explicitly tells us to wait longer than MAX_RATE_LIMIT_WAIT_SEC
    (default 300s / 5 min), we treat it as NON-retryable so the caller fails fast
    rather than sleeping for minutes. This implements the "retry only if the wait
    is small" requirement.
    """
    if isinstance(exc, TimeoutError):
        return False
    err_str = str(exc).lower()
    # Rate limiting (Groq/OpenAI/Anthropic/Gemini all use 429)
    if "rate_limit" in err_str or "429" in err_str:
        retry_after = parse_rate_limit_retry_after(exc)
        if retry_after > MAX_RATE_LIMIT_WAIT_SEC:
            print(f"  [!] Rate limit retry-after {retry_after:.0f}s exceeds "
                  f"MAX_RATE_LIMIT_WAIT_SEC={MAX_RATE_LIMIT_WAIT_SEC:.0f}s. "
                  f"NOT retrying — failing fast.")
            return False
        return True
    # Token/length limits that are transient
    if "tokens" in err_str or "token" in err_str:
        return True
    # Transient network / server errors (but NOT our hard TimeoutError above)
    if "timed out" in err_str:
        return True
    if "connection" in err_str or "network" in err_str:
        return True
    if "503" in err_str or "502" in err_str or "500" in err_str:
        return True
    if "server error" in err_str or "internal error" in err_str:
        return True
    return False


# ─── Retry Delay Calculation (exponential backoff) ──────────────────────────

def get_retry_delay(attempt: int) -> float:
    """
    Calculate the delay (in seconds) before the next retry using exponential
    backoff with jitter. `attempt` is 1-based (first retry = attempt 1).

    delay = RETRY_BASE_DELAY * RETRY_BACKOFF_FACTOR^(attempt-1) * jitter(±20%)
    then capped at RETRY_MAX_DELAY (cap applied AFTER jitter so the result
    never exceeds the configured maximum).
    """
    if attempt < 1:
        attempt = 1
    raw_delay = RETRY_BASE_DELAY * (RETRY_BACKOFF_FACTOR ** (attempt - 1))
    # Add ±20% jitter first, then cap so we never exceed the max delay
    jitter = random.uniform(0.8, 1.2)
    delayed = raw_delay * jitter
    capped_delay = min(delayed, RETRY_MAX_DELAY)
    return round(capped_delay, 2)


# ─── Policy Decision Helpers ────────────────────────────────────────────────

def should_fallback() -> bool:
    """Return True if the configured policy is to fall back on error (graceful)."""
    return ERROR_POLICY == "fallback"


def should_abort() -> bool:
    """Return True if the configured policy is to abort (fail-fast) on error."""
    return ERROR_POLICY == "abort"


def get_policy_summary() -> Dict[str, Any]:
    """Return a summary dict of the current error-handling policy."""
    return {
        "error_policy": ERROR_POLICY,
        "max_retries": MAX_RETRIES,
        "retry_base_delay": RETRY_BASE_DELAY,
        "retry_max_delay": RETRY_MAX_DELAY,
        "retry_backoff_factor": RETRY_BACKOFF_FACTOR,
        "max_retry_wait_sec": MAX_RETRY_WAIT_SEC,
        "should_fallback": should_fallback(),
        "should_abort": should_abort(),
    }


# ─── Generic Retry Wrapper ──────────────────────────────────────────────────

def with_retry(
    func: Callable[..., T],
    *args: Any,
    max_retries: Optional[int] = None,
    retryable: Optional[Callable[[BaseException], bool]] = None,
    on_retry: Optional[Callable[[BaseException, int], None]] = None,
    **kwargs: Any,
) -> T:
    """
    Execute `func(*args, **kwargs)` with retry logic.

    Args:
        func: The callable to execute.
        max_retries: Max retry attempts (defaults to MAX_RETRIES config).
        retryable: Optional predicate to determine if an error is retryable.
                   Defaults to is_retryable_error.
        on_retry: Optional callback invoked before each retry with (error, attempt).
        *args, **kwargs: Passed to func.

    Returns:
        The result of func.

    Raises:
        The last exception if all retries are exhausted.
    """
    max_retries = max_retries if max_retries is not None else MAX_RETRIES
    retryable = retryable or is_retryable_error

    attempt = 0
    total_wait = 0.0
    while True:
        try:
            return func(*args, **kwargs)
        except BaseException as e:  # noqa: BLE001 - we need to catch all for retry logic
            attempt += 1
            if attempt > max_retries or not retryable(e):
                raise
            # Prefer the provider's explicit retry-after hint (e.g. Groq's
            # "Please try again in 2h9m16.128s") as the delay. This honors the
            # "retry only if the wait is small" requirement: if the provider
            # says wait > MAX_RATE_LIMIT_WAIT_SEC, is_retryable_error already
            # returned False, so we never reach here. If the provider gives a
            # short retry-after (<= 5 min), we wait exactly that long.
            retry_after = parse_rate_limit_retry_after(e)
            if retry_after > 0:
                delay = min(retry_after, MAX_RETRY_WAIT_SEC)
            else:
                delay = get_retry_delay(attempt)
            # Only retry if the wait budget allows it. If the next delay
            # would push the cumulative retry wait beyond MAX_RETRY_WAIT_SEC,
            # skip the retry and surface the error so the caller's policy
            # (fallback/abort) takes over. This implements the "retry only if
            # the retry time is small" requirement and prevents sleeping
            # indefinitely on a long provider-cooldown.
            if MAX_RETRY_WAIT_SEC > 0 and (total_wait + delay) > MAX_RETRY_WAIT_SEC:
                print(f"  [!] Transient error ({type(e).__name__}: {e}). "
                      f"Skipping retry: next delay {delay}s would exceed "
                      f"MAX_RETRY_WAIT_SEC={MAX_RETRY_WAIT_SEC}s (already waited "
                      f"{total_wait:.1f}s). Deferring to error policy.")
                raise
            total_wait += delay
            if on_retry:
                on_retry(e, attempt)
            else:
                print(f"  [!] Transient error ({type(e).__name__}: {e}). "
                      f"Retrying in {delay}s (attempt {attempt}/{max_retries}, "
                      f"total wait {total_wait:.1f}s)...")
            time.sleep(delay)


# ─── Convenience: Handle a single LLM call with policy-aware behavior ───────

class ErrorPolicyError(RuntimeError):
    """Raised when the configured policy is 'abort' and an LLM error occurs."""


def handle_llm_error(
    exc: BaseException,
    context: str = "",
    fallback_func: Optional[Callable[[], Any]] = None,
) -> Any:
    """
    Policy-aware error handler for LLM calls.

    - If policy is 'fallback' and a fallback_func is provided, invoke the fallback
      and return its result.
    - If policy is 'abort' (or no fallback_func provided), raise an ErrorPolicyError
      wrapping the original exception.

    Args:
        exc: The original exception from the LLM call.
        context: Optional description of where the error occurred (for logging).
        fallback_func: Optional zero-arg callable to produce a fallback result.

    Returns:
        The fallback result if policy is 'fallback' and fallback_func is provided.

    Raises:
        ErrorPolicyError if policy is 'abort' or no fallback is available.
    """
    ctx = f" [{context}]" if context else ""
    reason = f"{type(exc).__name__}: {exc}"

    if should_fallback() and fallback_func is not None:
        print(f"⚠️ [ERROR POLICY] LLM error{ctx}: {reason}. Falling back to local extractor.")
        return fallback_func()

    # Abort policy (or no fallback available)
    print(f"❌ [ERROR POLICY] LLM error{ctx}: {reason}. "
          f"Policy='{ERROR_POLICY}' → aborting process (no fallback).")
    raise ErrorPolicyError(f"LLM error{ctx}: {reason}") from exc


# ─── Convenience: Retry with fallback (combines retry + policy) ─────────────

def llm_call_with_policy(
    func: Callable[[], T],
    fallback_func: Optional[Callable[[], Any]] = None,
    context: str = "",
    max_retries: Optional[int] = None,
    on_retry: Optional[Callable[[BaseException, int], None]] = None,
) -> T:
    """
    Execute an LLM call with retry logic, then apply the error policy if all
    retries are exhausted.

    - Retries up to `max_retries` times on retryable errors (rate limits, etc.).
    - After retries are exhausted:
        - If policy is 'fallback' and fallback_func is provided → return fallback.
        - Otherwise → raise ErrorPolicyError.

    Args:
        func: Zero-arg callable that performs the LLM call.
        fallback_func: Optional zero-arg callable for fallback on final failure.
        context: Optional description for logging.
        max_retries: Max retries (defaults to MAX_RETRIES config).
        on_retry: Optional callback before each retry.

    Returns:
        The LLM result, or the fallback result if policy is 'fallback'.

    Raises:
        ErrorPolicyError if policy is 'abort' or no fallback is available.
    """
    try:
        return with_retry(func, max_retries=max_retries, on_retry=on_retry)
    except BaseException as e:  # noqa: BLE001
        return handle_llm_error(e, context=context, fallback_func=fallback_func)

