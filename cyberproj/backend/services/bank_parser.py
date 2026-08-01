import os
import re
import pandas as pd
import numpy as np
from typing import Dict, Any, List

def parse_bank_statement(file_path: str) -> Dict[str, Any]:
    """
    Parses a bank statement file (CSV or Excel) and extracts key analytics,
    classifications, trends, and suspicious velocity patterns.
    """
    ext = os.path.splitext(file_path)[1].lower()
    
    try:
        if ext == ".csv":
            # Try parsing with comma first, fallback to semicolon
            try:
                df = pd.read_csv(file_path, encoding='utf-8')
            except UnicodeDecodeError:
                df = pd.read_csv(file_path, encoding='latin1')
        elif ext in [".xls", ".xlsx"]:
            df = pd.read_excel(file_path)
        else:
            raise ValueError(f"Unsupported bank file format: {ext}")
    except Exception as e:
        raise ValueError(f"Pandas failed to read bank file: {str(e)}")

    # Clean column headers
    df.columns = [str(c).strip().lower().replace("_", " ").replace(".", "") for c in df.columns]
    
    # 1. Precise regex column mapping with word boundaries
    date_patterns = [r'\bdate\b', r'\btxn date\b', r'\bvalue date\b', r'\btxndate\b', r'\bdt\b', r'\btimestamp\b', r'\bposted\b', r'\bentry\b', r'\btime\b']
    desc_patterns = [r'\bremarks description\b', r'\bdescription\b', r'\bparticulars\b', r'\bnarration\b', r'\bremarks\b', r'\bmemo\b', r'\bdetails\b', r'\bsummary\b', r'\bpayee\b', r'\bparty\b', r'\bnotes\b', r'\bref\b', r'\breference\b', r'\binfo\b']
    debit_patterns = [r'\bdebit amount\b', r'\bdebit amt\b', r'\bdebit\b', r'\bdr amt\b', r'\bdr amount\b', r'\bwithdrawal\b', r'\boutflow\b', r'\bpaid out\b']
    credit_patterns = [r'\bcredit amount\b', r'\bcredit amt\b', r'\bcredit\b', r'\bcr amt\b', r'\bcr amount\b', r'\bdeposit\b', r'\binflow\b', r'\bpaid in\b']
    bal_patterns = [r'\bbalance after txn\b', r'\bbalance\b', r'\bbal\b', r'\bnet balance\b']
    amt_patterns = [r'\bamount inr\b', r'\bamount\b', r'\bamt\b', r'\bvalue\b', r'\bsum\b', r'\btxn amt\b']
    type_patterns = [r'\btransaction type\b', r'\btype\b', r'\bpayment mode\b', r'\bcr/dr\b', r'\bcr dr\b', r'\btran type\b']

    date_col, desc_col, debit_col, credit_col, bal_col, amt_col, type_col = None, None, None, None, None, None, None

    for col in df.columns:
        if not date_col and any(re.search(p, col) for p in date_patterns):
            date_col = col
        if not desc_col and any(re.search(p, col) for p in desc_patterns):
            desc_col = col
        if not debit_col and any(re.search(p, col) for p in debit_patterns):
            debit_col = col
        if not credit_col and any(re.search(p, col) for p in credit_patterns):
            credit_col = col
        if not bal_col and any(re.search(p, col) for p in bal_patterns):
            bal_col = col
        if not amt_col and any(re.search(p, col) for p in amt_patterns):
            amt_col = col
        if not type_col and any(re.search(p, col) for p in type_patterns):
            type_col = col

    # Fallback matching if date or description are missing
    if not date_col and len(df.columns) > 0:
        date_col = df.columns[0]
        
    if not desc_col:
        for col in df.columns:
            if col != date_col:
                desc_col = col
                break
        if not desc_col and len(df.columns) > 0:
            desc_col = df.columns[0]

    # Check mapping success
    if not date_col or not desc_col:
        raise ValueError("Could not locate Date and Description/Narration columns in the file headers.")

    # Standardize DataFrame columns
    standard_df = pd.DataFrame()
    
    # Date parsing
    standard_df["date_raw"] = df[date_col].fillna("").astype(str)
    try:
        standard_df["date"] = pd.to_datetime(df[date_col], errors='coerce')
    except:
        standard_df["date"] = pd.NaT
        
    standard_df["narration"] = df[desc_col].fillna("").astype(str)
    
    # Helper to clean numeric columns
    def clean_num(val):
        if pd.isna(val):
            return 0.0
        val_str = str(val).replace(",", "").replace(" ", "").replace("INR", "").strip()
        if not val_str or val_str == "-" or val_str == "nan":
            return 0.0
        try:
            val_str = re.sub(r'[^\d\.\-]', '', val_str)
            return float(val_str) if val_str else 0.0
        except:
            return 0.0

    # Map Debit / Credit values intelligently
    # Map Debit / Credit values intelligently
    if amt_col and type_col:
        amounts = df[amt_col].apply(clean_num)
        types = df[type_col].fillna("").astype(str).str.upper()
        
        has_debit_kw = types.str.contains("DEBIT") | types.str.contains("DR") | types.str.contains("WITHDRAWAL") | types.str.contains("OUTFLOW")
        has_credit_kw = types.str.contains("CREDIT") | types.str.contains("CR") | types.str.contains("DEPOSIT") | types.str.contains("INFLOW")
        
        if has_debit_kw.any() or has_credit_kw.any():
            standard_df["debit"] = np.where(has_debit_kw, amounts, 0.0)
            standard_df["credit"] = np.where(has_credit_kw, amounts, 0.0)
        else:
            # Payment mode string like IMPS/NEFT/UPI/RTGS without explicit Credit/Debit label
            standard_df["debit"] = np.where(amounts < 0, abs(amounts), amounts)
            standard_df["credit"] = 0.0
    elif debit_col and credit_col and debit_col != desc_col and credit_col != desc_col:
        standard_df["debit"] = df[debit_col].apply(clean_num)
        standard_df["credit"] = df[credit_col].apply(clean_num)
    elif amt_col:
        amounts = df[amt_col].apply(clean_num)
        standard_df["debit"] = np.where(amounts < 0, abs(amounts), amounts)
        standard_df["credit"] = np.where(amounts < 0, 0.0, 0.0)
    elif debit_col:
        standard_df["debit"] = df[debit_col].apply(clean_num)
        standard_df["credit"] = 0.0
    elif credit_col:
        standard_df["debit"] = 0.0
        standard_df["credit"] = df[credit_col].apply(clean_num)
    else:
        raise ValueError("Could not find Amount or Debit/Credit columns in file.")

    if bal_col:
        standard_df["balance"] = df[bal_col].apply(clean_num)
    else:
        standard_df["balance"] = 0.0

    # Counterparty column check
    cp_col = None
    for col in df.columns:
        if any(x in col.lower() for x in ["recipient", "counterparty", "beneficiary", "payee", "to account"]):
            cp_col = col
            break
            
    if cp_col:
        standard_df["counterparty_col"] = df[cp_col].fillna("").astype(str)
    else:
        standard_df["counterparty_col"] = ""

    # Remove rows where date and narration are both empty
    standard_df = standard_df[~((standard_df["date_raw"] == "") & (standard_df["narration"] == ""))]
    
    # Analyze data
    total_records = len(standard_df)
    
    # Transaction sums
    total_debit_amt = float(standard_df["debit"].sum())
    total_credit_amt = float(standard_df["credit"].sum())
    debit_count = int((standard_df["debit"] > 0).sum())
    credit_count = int((standard_df["credit"] > 0).sum())
    
    # Categories (Fuzzy Narration & Type Matching)
    def match_cat(row):
        narr_upper = str(row["narration"]).upper()
        type_upper = str(df.loc[row.name, type_col]).upper() if type_col and row.name in df.index else ""
        combined = narr_upper + " " + type_upper
        
        if any(x in combined for x in ["ATM", "CASH WDL", "CASH WITHDRAWAL", "NFS"]):
            return "ATM Withdrawal"
        elif "IMPS" in combined:
            return "IMPS Transfer"
        elif any(x in combined for x in ["UPI", "PAYTM", "GPAY", "BHIM", "PHONEPE", "GPHONE"]):
            return "UPI Payment"
        elif "NEFT" in combined:
            return "NEFT Transfer"
        elif "RTGS" in combined:
            return "RTGS Transfer"
        elif any(x in combined for x in ["CASH DEP", "CASH DEPOSIT", "CDM"]):
            return "Cash Deposit"
        elif any(x in combined for x in ["POS", "MERCHANT", "E-COMMERCE", "COMMERCE", "AMAZON", "FLIPKART"]):
            return "Merchant POS"
        else:
            return "Other / Transfer"

    standard_df["category"] = standard_df.apply(match_cat, axis=1)
    
    # Group by category counts and sums
    category_summary = {}
    for cat in standard_df["category"].unique():
        cat_df = standard_df[standard_df["category"] == cat]
        category_summary[cat] = {
            "count": int(len(cat_df)),
            "debit_total": float(cat_df["debit"].sum()),
            "credit_total": float(cat_df["credit"].sum())
        }
        
    # High-value transactions (Threshold: 25,000 INR)
    high_val_threshold = 25000.0
    high_debits_df = standard_df[standard_df["debit"] >= high_val_threshold]
    high_credits_df = standard_df[standard_df["credit"] >= high_val_threshold]
    
    high_value_transfers = []
    for idx, row in pd.concat([high_debits_df, high_credits_df]).iterrows():
        high_value_transfers.append({
            "date": str(row["date_raw"]),
            "narration": row["narration"],
            "debit": float(row["debit"]),
            "credit": float(row["credit"]),
            "category": row["category"]
        })
        
    # Extract Potential VPA / Account Beneficiaries
    beneficiaries = []
    upi_pattern = re.compile(r'([a-zA-Z0-9\.\-_]+@[a-zA-Z0-9]+)')
    acc_pattern = re.compile(r'(?:tfr to|transfer to|a/c|ac)\s*(\d{9,18})', re.IGNORECASE)
    
    for idx, row in standard_df.iterrows():
        narr = row["narration"]
        cp_val = row.get("counterparty_col", "").strip()
        
        counterparty = "Unknown"
        if cp_val and cp_val != "nan":
            counterparty = cp_val
        else:
            match_upi = upi_pattern.search(narr)
            match_acc = acc_pattern.search(narr)
            if match_upi:
                counterparty = match_upi.group(1)
            elif match_acc:
                counterparty = f"A/C: {match_acc.group(1)}"
            
        if counterparty != "Unknown":
            tx_vol = float(row["debit"]) if row["debit"] > 0 else float(row["credit"])
            if tx_vol == 0.0 and (row["debit"] == 0 and row["credit"] == 0):
                tx_vol = 1.0 # default non-zero indicator
            beneficiaries.append({
                "counterparty": counterparty,
                "amount": tx_vol,
                "type": "debit" if row["debit"] > 0 else "credit"
            })

            
    # Aggregate beneficiaries
    ben_df = pd.DataFrame(beneficiaries)
    top_counterparts = {}
    if not ben_df.empty:
        top_ben = ben_df.groupby("counterparty").agg(
            total_volume=("amount", "sum"),
            tx_count=("amount", "count")
        ).sort_values(by="total_volume", ascending=False).head(10)
        
        for cp, r in top_ben.iterrows():
            top_counterparts[cp] = {
                "volume": float(r["total_volume"]),
                "count": int(r["tx_count"])
            }

    # Timeline & Trends (Daily stats)
    daily_stats = {}
    if not standard_df["date"].isna().all():
        valid_dates_df = standard_df[~standard_df["date"].isna()]
        daily_grp = valid_dates_df.groupby(valid_dates_df["date"].dt.strftime("%Y-%m-%d")).agg(
            debit_sum=("debit", "sum"),
            credit_sum=("credit", "sum"),
            tx_count=("narration", "count")
        )
        for date_str, r in daily_grp.iterrows():
            daily_stats[date_str] = {
                "debit": float(r["debit_sum"]),
                "credit": float(r["credit_sum"]),
                "count": int(r["tx_count"])
            }
            
    # Weekly stats
    weekly_stats = {}
    if not standard_df["date"].isna().all():
        valid_dates_df = standard_df[~standard_df["date"].isna()]
        # We group by year and week number
        weekly_grp = valid_dates_df.groupby(valid_dates_df["date"].dt.to_period("W").dt.strftime("%Y-W%U")).agg(
            debit_sum=("debit", "sum"),
            credit_sum=("credit", "sum"),
            tx_count=("narration", "count")
        )
        for week_str, r in weekly_grp.iterrows():
            weekly_stats[week_str] = {
                "debit": float(r["debit_sum"]),
                "credit": float(r["credit_sum"]),
                "count": int(r["tx_count"])
            }

    # Suspicious Pattern Detection
    suspicious_patterns = []
    
    # Pattern 1: Rapid Movement of Funds (credits immediately cashed out)
    if not standard_df["date"].isna().all():
        valid_dates_df = standard_df[~standard_df["date"].isna()]
        for date_val in valid_dates_df["date"].unique():
            day_txs = valid_dates_df[valid_dates_df["date"] == date_val]
            credits_today = day_txs["credit"].sum()
            debits_today = day_txs["debit"].sum()
            
            # If same-day credit is > 10,000 and debit is >= 95% of credit
            if credits_today > 10000 and (debits_today >= 0.95 * credits_today) and (debits_today <= 1.05 * credits_today):
                date_str = pd.Timestamp(date_val).strftime("%Y-%m-%d")
                suspicious_patterns.append({
                    "type": "Rapid Cash-Out / Fund Washing",
                    "description": f"On {date_str}, accounts received credits of Rs. {credits_today:,.2f} and debits of Rs. {debits_today:,.2f} (Rapid wash cycle).",
                    "severity": "high"
                })
                
    # Pattern 2: Round Sum transfers (Multiples of 10000 or 50000)
    round_sum_credits = standard_df[(standard_df["credit"] > 0) & (standard_df["credit"] % 10000 == 0) & (standard_df["credit"] >= 10000)]
    if len(round_sum_credits) >= 3:
        suspicious_patterns.append({
            "type": "Multiple Round-Sum Credits",
            "description": f"Detected {len(round_sum_credits)} credit events in round multiples of 10,000 (indicative of structured deposits/mule activity).",
            "severity": "medium"
        })
        
    # Pattern 3: Nighttime Transactions (10 PM to 6 AM)
    nighttime_txs = 0
    nighttime_val = 0.0
    if not standard_df["date"].isna().all():
        # Check hour if date contains time. Some statements only have dates.
        # We parse the raw strings or clean them
        for idx, row in standard_df.iterrows():
            raw_dt = row["date_raw"]
            # Look for time patterns like hh:mm or hh:mm:ss
            time_match = re.search(r'(\d{2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?', raw_dt, re.IGNORECASE)
            if time_match:
                hr = int(time_match.group(1))
                ampm = time_match.group(4)
                if ampm:
                    ampm = ampm.upper()
                    if ampm == "PM" and hr != 12:
                        hr += 12
                    elif ampm == "AM" and hr == 12:
                        hr = 0
                if hr >= 22 or hr < 6:
                    nighttime_txs += 1
                    nighttime_val += (row["debit"] + row["credit"])
                    
        if nighttime_txs >= 5:
            suspicious_patterns.append({
                "type": "Nighttime Calling/Activity",
                "description": f"Identified {nighttime_txs} transactions totaling Rs. {nighttime_val:,.2f} executed between 10:00 PM and 06:00 AM.",
                "severity": "low"
            })

    return {
        "total_records": total_records,
        "total_debits": total_debit_amt,
        "total_credits": total_credit_amt,
        "debit_count": debit_count,
        "credit_count": credit_count,
        "categories": category_summary,
        "high_value_transfers": high_value_transfers[:20], # limit list
        "top_counterparts": top_counterparts,
        "daily_stats": daily_stats,
        "weekly_stats": weekly_stats,
        "suspicious_patterns": suspicious_patterns
    }
