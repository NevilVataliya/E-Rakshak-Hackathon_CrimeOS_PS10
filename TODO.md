# Fix Agentic RAG System Response Issues

## Steps
- [x] Add `money_trail` field to `ai-service/app/models/schemas.py`
- [x] Fix Gujarati/Hindi numeral parsing in `ai-service/app/ingestion/heuristic_extractor.py`
- [x] Enhance ingestion prompt in `ai-service/app/ingestion/smart_router.py`
- [x] Enhance BNS agent prompt in `ai-service/app/agents/specialists/bns_agent.py`
- [x] Enhance cyber agent prompt in `ai-service/app/agents/specialists/cyber_agent.py`
- [x] Add money-trail tracing step in `ai-service/app/agents/nodes/synthesis.py`
- [x] Verify Gujarati numeral parsing fix (₹9,00,000 correctly parsed)
- [x] Add deterministic monetary loss override in `ai-service/app/ingestion/smart_router.py` (picks largest amount from raw text)
- [x] Add money-trail keyword requirement in `ai-service/app/agents/specialists/cyber_agent.py`
- [x] End-to-end verification passed (money loss ₹9,00,000, BNS 318/351 ✅, money-trail tracing ✅, synthesis step ✅)

## Root Causes Identified
1. **Monetary loss ₹90,000 vs ₹9,00,000** - Gujarati numeral regex only matches ASCII digits
2. **Missing BNS 318 (Cheating) & BNS 351 (Criminal Intimidation)** - prompts don't infer implied sections
3. **Section inconsistency between stages** - no reconciliation between ingestion and BNS agent
4. **Key facts too generic** - prompt doesn't require specific amounts/trail/findings
5. **Missing money-trail tracing step** - cyber agent doesn't trace full transfer chain
