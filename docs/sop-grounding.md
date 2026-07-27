# Crime OS AI — SOP Grounding & Legal RAG Documentation

## 1. Legal Statute & SOP Mapping

Crime OS AI grounds all investigation paths and recommendations in the new criminal laws of India and applicable special laws:

1. **Bharatiya Nyaya Sanhita (BNS), 2023**: Replaces Indian Penal Code (IPC).
   - Section 318(4) BNS: Cheating and dishonestly inducing delivery of property.
   - Section 319 BNS: Cheating by personation.
   - Section 305 / 331 BNS: Housebreaking and theft.
2. **Bharatiya Nagarik Suraksha Sanhita (BNSS), 2023**: Replaces Code of Criminal Procedure (CrPC).
   - Section 94 BNSS: Order to produce documents or electronic records (Notice to Telecom/Banks).
   - Section 105 BNSS: Search and seizure procedures & Spot Panchnama.
   - Section 180 BNSS: Examination of witnesses by police.
3. **Bharatiya Sakshya Adhiniyam (BSA), 2023**: Replaces Indian Evidence Act.
   - Section 63 BSA: Admissibility of electronic records and mandatory electronic evidence certificates.
4. **Information Technology Act, 2000**:
   - Section 66D IT Act: Cheating by personation using computer resource.

---

## 2. Qdrant Payload Filtering Strategy

All documents in `/database/doc/*.pdf` are chunked using Docling and stored in Qdrant with `target_specialist` payload tags:
- `bns_specialist`
- `bsa_specialist`
- `cyber_financial_intel_specialist`
- `conventional_field_specialist`

When a Specialist Agent executes, Qdrant enforces payload filtering via `FieldCondition(key="target_specialist", match=MatchValue(value=...))` to ensure 100% relevant context retrieval with zero hallucinated statutes.
