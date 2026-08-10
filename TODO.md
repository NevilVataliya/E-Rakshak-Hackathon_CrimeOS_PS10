# CrimeOS Intake Flow Bug Fixes

## Approved Plan
1. [x] Fix `frontend/src/views/IntakeView.tsx` — Move `/api/ingest` POST outside `if (attachedFiles.length > 0)` so plain-text complaints always hit backend extraction pipeline
2. [x] Fix `ai-service/app/ingestion/smart_router.py` — Add timeout to LLM invocation so it fails fast and triggers heuristic fallback instead of hanging
3. [x] Fix `ai-service/config.py` — Prefer Gemini over Groq in auto-selection for better Gujarati/Indic extraction
4. [x] Test — Re-run curl against `/api/ingest` with full Gujarati text to verify extraction works

## Status
- Root cause identified: 
  - Bug 1: Plain-text intake never calls `/api/ingest` (frontend fakes progress, creates empty case)
  - Bug 2: Backend LLM call has no timeout, hangs indefinitely on Groq API request

## Fixes Applied
1. **`frontend/src/views/IntakeView.tsx`** — `/api/ingest` POST moved outside `if (attachedFiles.length > 0)` so plain-text always hits backend.
2. **`ai-service/app/ingestion/smart_router.py`** — `_invoke_llm_with_timeout()` helper (ThreadPoolExecutor, 60s `LLM_CALL_TIMEOUT_SEC`) wired into `with_retry` call. Removed `with ThreadPoolExecutor(...)` context manager (its `shutdown(wait=True)` blocked on orphaned thread, defeating the timeout). Now uses `executor.shutdown(wait=False)` so the timeout fires immediately.
3. **`ai-service/config.py`** — Added `max_retries=0` to ALL LLM factory calls to disable langchain's internal 429/rate-limit retry loop that blocked for 60s+.
4. **`ai-service/app/utils/error_policy.py`** — `is_retryable_error()` returns `False` for `isinstance(exc, TimeoutError)` so hard timeout goes straight to heuristic fallback.
5. **`docker-compose.yml`** — Added `LLM_PROVIDER=${LLM_PROVIDER:-groq}` env var. **Gemini API key is exhausted (429 quota, limit: 0)** — auto-selection preferred Gemini, which failed. Now forced to Groq.

## Test Result (Groq)
- **Status Code: 200**
- **processing_mode: HYBRID_ONLINE** (Groq LLM call succeeded, NOT fallback)
- **fallback_used: False**
- **monetary_loss: 900000** (₹9,00,000 correctly extracted from Gujarati numerals)
- **bank_accounts**: Union Bank (victim, is_victim_account=true), Indusind Bank (INDB0000184), IDBI Bank (IBKL0001006)
- **persons**: Indrajitsinh (investigator), Zahir Husen (accused, questioned), Monish urfe Monu (absconding), Vithal (absconding)
- **phone_numbers**: +6612336761, +2223755264
- **crime_sub_type**: Online Scam
- **severity_score**: 8.5
