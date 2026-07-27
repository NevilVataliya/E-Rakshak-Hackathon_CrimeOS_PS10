# Empirical Qdrant RAG Benchmark Evaluation — Scorecard & Diagnostic Report

We executed our first automated mathematical evaluation of Qdrant Vector Retrieval using our persistent inverted benchmark dataset (`rag_benchmark_v1.json`, 21 test cases).

---

## 1. Empirical Evaluation Scorecard Results

```
=========================================================================
                QDRANT RAG BENCHMARK SCORECARD SUMMARY
=========================================================================
 ATOMIC SINGLE-CHUNK EVALUATION (19 Test Cases):
   • Hit Rate @ 3:             57.9%
   • Hit Rate @ 5:             63.2%  (Target: ≥ 95.0%)  [NEEDS OPTIMIZATION]
   • Hit Rate @ 10:            63.2%
   • Context Precision @ 5:    21.1%  (Target: ≥ 85.0%)  [NEEDS OPTIMIZATION]
   • Mean Reciprocal Rank:     0.502   (Target: ≥ 0.850)  [NEEDS OPTIMIZATION]
-------------------------------------------------------------------------
 COMPOSITE MULTI-DOCUMENT EVALUATION (2 Test Cases):
   • Multi-Target Recall @ K:  12.5%  (Target: ≥ 90.0%)  [NEEDS OPTIMIZATION]
   • Full Compound Coverage:   0.0%
=========================================================================
```

---

## 2. Key Diagnostic Findings & Strengths

### Strengths Identified:
- **Rank 1 Accuracy on Clear SOP Queries**: When Qdrant retrieved the correct document, it retrieved it at **Rank 1 or Rank 2** in **10 out of 19 cases** (52.6% of all test cases returned the exact target document at Rank 1/2)!
- Examples of Rank 1 Hits:
  - `BENCH-ATOMIC-004` -> **Rank 1** (`101_FAQS_EOW_INVESTIGATIONS.pdf p.16`)
  - `BENCH-ATOMIC-005` -> **Rank 1** (`I4C_CFCFRMS_Financial_Fraud_SOP.pdf p.11`)
  - `BENCH-ATOMIC-006` -> **Rank 1** (`BNS_Penal_Code_2024.pdf p.27`)
  - `BENCH-ATOMIC-008` -> **Rank 1** (`RBI_Customer_Liability_Circular_2017.pdf p.3`)
  - `BENCH-ATOMIC-009` -> **Rank 1** (`Telecommunications_Act_2023.pdf p.15`)
  - `BENCH-ATOMIC-011` -> **Rank 1** (`RBI_Customer_Liability_Circular_2017.pdf p.6`)
  - `BENCH-ATOMIC-017` -> **Rank 1** (`THE_GUJARAT_POLICE_MANUAL.pdf p.173`)
  - `BENCH-ATOMIC-019` -> **Rank 1** (`THE_GUJARAT_POLICE_MANUAL.pdf p.74`)

---

## 3. Root-Cause Analysis of Missed Cases (36.8% Miss Rate)

1. **Semantic Dilution in Query Vectors**:
   - Passing raw conversational narratives ("Sir main Rahul bol raha hu...") combined with generic filler words (`"penal section SOP guidelines"`) causes vector drift in dense embedding space (`BAAI/bge-m3`).
2. **Compound Query Vector Degradation**:
   - For composite multi-document cases, passing a single 1,000-character multi-topic complaint narrative into a single query vector dilutes individual topic signals, causing Qdrant to retrieve chunks for only 1 out of 4 target documents (12.5% Recall).
3. **Payload Filter Restrictiveness**:
   - Strict `target_specialist` payload filters sometimes excluded relevant cross-domain SOPs (e.g. `RBI_Master_Direction_KYC.pdf` tagged under cyber instead of bns).

---

## 4. Action Plan for RAG Retrieval Optimization

1. **Legal Query Normalization & HyDE (Hypothetical Document Embeddings)**:
   - Extract a clean, standardized legal search query string before vector embedding to prevent conversational noise from diluting vector distance.
2. **Multi-Query Decomposition for Composite Cases**:
   - Split composite multi-offense complaints into targeted sub-queries per specialist domain (Penal Query, Cyber SOP Query, Field Procedure Query, BSA Evidence Query).
3. **Re-Benchmark & Measure Improvements**:
   - Re-run `run_rag_benchmark.py` to empirically measure Hit Rate improvement toward our **$\ge 95\%$ target**.
