# Crime OS AI — Automation & Turnkey Requisition Logic

## 1. Automated Legal Notice Generation Workflow

```
[Complaint Ingested] 
       |
       v
[LangGraph Agent Studio Executes]
       |
       v
[Synthesis Node Triggers ReportLab PDF Engine]
       |
       v
[Section 94 BNSS Legal Notice Rendered with Police Seal]
       |
       v
[SHO / IO Approves & Dispatches via Gateway Proxy]
```

## 2. Supported Legal Requisition Templates

1. **Section 94 BNSS Notice to Telecom Operators**:
   - Requisitions Call Detail Records (CDR), Cell Tower ID Locations, IMEI logs, and Subscriber Registration Forms (CAF).
2. **Section 94 BNSS Debit Freeze Notice to Banks**:
   - Directs immediate debit freeze on beneficiary bank accounts / UPI VPAs associated with financial fraud.
3. **LERS IPDR & Social Media Preservation Requisition**:
   - Requests IP login logs, registration email, and account preservation from platforms.
