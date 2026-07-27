# Qdrant Multi-Query RAG Benchmark Evaluation Report v3

**Evaluated Date:** 2026-07-27 18:32
**Benchmark File:** rag_benchmark_v2.json
**Pipeline:** Multi-Query Decomposition + HyDE + Dense/BM25 RRF + CrossEncoder Reranker
**Total Test Cases:** 40

## Executive Scorecard Summary

| Evaluation Metric | Measure | Target | Status |
|---|---|---|---|
| **Hit Rate @ 5 (Atomic)** | 45.8% | ≥ 95.0% | NEEDS_TUNING |
| **Hit Rate @ 15 (Atomic)** | 58.3% | ≥ 95.0% | NEEDS_TUNING |
| **Context Precision @ 5** | 15.8% | ≥ 85.0% | NEEDS_TUNING |
| **Mean Reciprocal Rank (MRR)** | 0.371 | ≥ 0.850 | NEEDS_TUNING |
| **Multi-Target Recall @ 15** | 14.1% | ≥ 90.0% | NEEDS_TUNING |
| **Avg Latency** | 6536ms | < 1500ms | NEEDS_TUNING |

