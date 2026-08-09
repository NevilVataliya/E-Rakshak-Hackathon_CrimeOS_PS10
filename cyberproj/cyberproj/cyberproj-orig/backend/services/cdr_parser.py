import pandas as pd
import numpy as np
import re
import os
from typing import Dict, Any, List

def clean_phone(val) -> str:
    if pd.isna(val):
        return ""
    val_str = str(val).strip()
    # Remove decimal points if parsed as float (e.g. 9999999999.0)
    if val_str.endswith(".0"):
        val_str = val_str[:-2]
    # Remove non-alphanumeric chars except + (keep it simple, just keep numbers and +)
    val_cleaned = re.sub(r"[^\d+]", "", val_str)
    return val_cleaned

def parse_cdr_file(file_path: str) -> Dict[str, Any]:
    """
    Parses a CDR file (CSV or Excel) and extracts key statistics.
    Returns a dictionary with summarized stats ready for the UI and AI analysis.
    """
    # 1. Load File
    _, ext = os.path.splitext(file_path.lower())
    df = None
    
    if ext in [".xls", ".xlsx"]:
        df = pd.read_excel(file_path)
    else:
        # Try multiple encodings for CSV
        for encoding in ["utf-8", "latin1", "cp1252"]:
            try:
                df = pd.read_csv(file_path, encoding=encoding)
                break
            except Exception:
                continue
    
    if df is None:
        raise ValueError("Could not read file. Supported formats: CSV, XLS, XLSX.")
    
    # Trim column names
    df.columns = [str(col).strip() for col in df.columns]
    
    # 2. Map Columns (fuzzy match)
    col_mapping = {}
    
    # Patterns for fuzzy matching
    patterns = {
        "a_number": r"(calling|a[-_ ]party|msisdn|originating|src|source|from|caller|sender)",
        "b_number": r"(called|b[-_ ]party|destination|dest|target|to|dialed|receiver|recipient)",
        "date_time": r"(date|time|timestamp|start|datetime|event[-_ ]time)",
        "duration": r"(duration|dur|sec|seconds|length)",
        "call_type": r"(type|direction|event|category|call[-_ ]type|sms|voice)",
        "imei": r"(imei|handset|device)",
        "imsi": r"(imsi|sim)",
        "cell_id": r"(cell|tower|lac|cgi|location|address|site|sector)"
    }
    
    for key, pattern in patterns.items():
        matched_cols = [col for col in df.columns if re.search(pattern, col, re.IGNORECASE)]
        if matched_cols:
            # Prefer shorter column names or exact matches if possible, otherwise first match
            col_mapping[key] = matched_cols[0]
            
    # Fallback if A/B party columns not explicitly matched, look for phone-like headers
    if "a_number" not in col_mapping:
        phone_cols = [col for col in df.columns if "num" in col.lower() or "phone" in col.lower() or "mobile" in col.lower()]
        if len(phone_cols) >= 1:
            col_mapping["a_number"] = phone_cols[0]
        if len(phone_cols) >= 2 and "b_number" not in col_mapping:
            col_mapping["b_number"] = phone_cols[1]

    # If still not found, use first and second columns as A and B numbers
    if "a_number" not in col_mapping and len(df.columns) > 0:
        col_mapping["a_number"] = df.columns[0]
    if "b_number" not in col_mapping and len(df.columns) > 1:
        col_mapping["b_number"] = df.columns[1]
    if "date_time" not in col_mapping and len(df.columns) > 2:
        col_mapping["date_time"] = df.columns[2]

    # 3. Clean and Standardize Data
    df_clean = pd.DataFrame()
    
    a_col = col_mapping.get("a_number")
    b_col = col_mapping.get("b_number")
    dt_col = col_mapping.get("date_time")
    dur_col = col_mapping.get("duration")
    type_col = col_mapping.get("call_type")
    imei_col = col_mapping.get("imei")
    imsi_col = col_mapping.get("imsi")
    cell_col = col_mapping.get("cell_id")

    if a_col:
        df_clean["a_number"] = df[a_col].apply(clean_phone)
    else:
        df_clean["a_number"] = ""

    if b_col:
        df_clean["b_number"] = df[b_col].apply(clean_phone)
    else:
        df_clean["b_number"] = ""

    # Parse Date and Time
    if dt_col:
        # Fill missing dates
        df[dt_col] = df[dt_col].fillna("")
        df_clean["date_time_raw"] = df[dt_col].astype(str)
        # Attempt conversion
        df_clean["date_time"] = pd.to_datetime(df[dt_col], errors="coerce")
    else:
        df_clean["date_time"] = pd.NaT
        df_clean["date_time_raw"] = ""

    # Parse Duration
    if dur_col:
        # Clean duration (extract digits)
        def clean_dur(val):
            if pd.isna(val):
                return 0
            val_str = str(val).strip()
            # If formatted like HH:MM:SS
            if ":" in val_str:
                parts = val_str.split(":")
                try:
                    if len(parts) == 3:
                        return int(parts[0])*3600 + int(parts[1])*60 + int(parts[2])
                    elif len(parts) == 2:
                        return int(parts[0])*60 + int(parts[1])
                except Exception:
                    pass
            # Just extract digits
            digits = re.findall(r"\d+", val_str)
            return int(digits[0]) if digits else 0
        df_clean["duration"] = df[dur_col].apply(clean_dur)
    else:
        df_clean["duration"] = 0

    # Call Type
    if type_col:
        df_clean["call_type"] = df[type_col].astype(str).str.upper().str.strip()
    else:
        df_clean["call_type"] = "VOICE" # Default

    # Handset details (IMEI / IMSI)
    if imei_col:
        df_clean["imei"] = df[imei_col].astype(str).str.strip()
    else:
        df_clean["imei"] = ""

    if imsi_col:
        df_clean["imsi"] = df[imsi_col].astype(str).str.strip()
    else:
        df_clean["imsi"] = ""

    # Cell ID/Tower
    if cell_col:
        df_clean["cell_id"] = df[cell_col].astype(str).str.strip()
    else:
        df_clean["cell_id"] = ""

    # 4. Generate Summaries & Aggregates
    total_records = len(df_clean)
    
    # Clean datetime errors by filling with median or omitting for time series
    valid_dates = df_clean[df_clean["date_time"].notna()]
    min_date = valid_dates["date_time"].min()
    max_date = valid_dates["date_time"].max()
    
    date_range_str = f"{min_date.strftime('%Y-%m-%d %H:%M:%S')} to {max_date.strftime('%Y-%m-%d %H:%M:%S')}" if not valid_dates.empty else "Unknown"

    # Top Called / Calling Partners
    # Let's count how many times each number is involved
    all_numbers = pd.concat([df_clean["a_number"], df_clean["b_number"]])
    # Filter empty or system numbers
    all_numbers = all_numbers[all_numbers != ""]
    top_contacts = all_numbers.value_counts().head(20).to_dict()

    # Call Frequency Matrix (A-party & B-party pairs)
    pairs = df_clean.groupby(["a_number", "b_number"]).size().reset_index(name="count")
    pairs = pairs[(pairs["a_number"] != "") & (pairs["b_number"] != "")]
    top_pairs = pairs.sort_values(by="count", ascending=False).head(15).to_dict(orient="records")

    # Call durations sum by partner
    # Outgoing calls from our primary subject: we need to identify who is the primary subject.
    # The primary subject is usually the one that appears most as the A_number (or the B_number if it's incoming).
    # Let's count the frequency of all A_numbers and B_numbers to determine the suspect number.
    a_counts = df_clean["a_number"].value_counts()
    b_counts = df_clean["b_number"].value_counts()
    suspect_candidate = ""
    if not a_counts.empty:
        suspect_candidate = a_counts.index[0]
        # If it's a very common number (like a blank or system number), take the next
        if suspect_candidate == "" and len(a_counts) > 1:
            suspect_candidate = a_counts.index[1]

    # Nighttime Calls (10 PM to 6 AM)
    night_calls = 0
    night_records = []
    if not valid_dates.empty:
        df_clean["hour"] = df_clean["date_time"].dt.hour
        night_df = df_clean[(df_clean["hour"] >= 22) | (df_clean["hour"] < 6)]
        night_calls = len(night_df)
        night_records = night_df.head(10)[["a_number", "b_number", "date_time_raw", "duration", "cell_id"]].to_dict(orient="records")
        for rec in night_records:
            if isinstance(rec.get("date_time_raw"), pd.Timestamp):
                rec["date_time_raw"] = rec["date_time_raw"].strftime("%Y-%m-%d %H:%M:%S")
    else:
        df_clean["hour"] = -1

    # Hourly distribution for charts
    hourly_dist = [0] * 24
    if not valid_dates.empty:
        hours_counts = df_clean["hour"].value_counts().to_dict()
        for h in range(24):
            hourly_dist[h] = int(hours_counts.get(h, 0))

    # Daily distribution for charts
    daily_dist = {}
    if not valid_dates.empty:
        df_clean["day"] = df_clean["date_time"].dt.strftime("%Y-%m-%d")
        daily_counts = df_clean["day"].value_counts().sort_index().to_dict()
        daily_dist = {day: int(count) for day, count in daily_counts.items()}

    # IMEI & IMSI mapping (IMEI swaps indicate changing devices)
    imei_swaps = []
    if imei_col and not df_clean["imei"].eq("").all():
        imei_by_num = df_clean.groupby("a_number")["imei"].nunique()
        multiple_imeis = imei_by_num[imei_by_num > 1]
        for num in multiple_imeis.index:
            if num == "": continue
            imeis = df_clean[df_clean["a_number"] == num]["imei"].unique().tolist()
            imeis = [i for i in imeis if i and i != "nan"]
            if len(imeis) > 1:
                imei_swaps.append({"number": num, "imeis": imeis})

    # Location Analysis (Cell ID visits)
    top_locations = {}
    if cell_col:
        locs = df_clean[df_clean["cell_id"] != ""]
        top_locations = locs["cell_id"].value_counts().head(10).to_dict()

    # Create a compact summary for the LLM to read
    # We include statistical summaries instead of raw rows, but also include the top 30 most active call logs
    sample_records = df_clean.head(50)[["a_number", "b_number", "date_time_raw", "duration", "call_type", "cell_id"]].to_dict(orient="records")
    for rec in sample_records:
        if isinstance(rec.get("date_time_raw"), pd.Timestamp):
            rec["date_time_raw"] = rec["date_time_raw"].strftime("%Y-%m-%d %H:%M:%S")

    return {
        "total_records": total_records,
        "date_range": date_range_str,
        "suspect_candidate": suspect_candidate,
        "top_contacts": {k: int(v) for k, v in top_contacts.items()},
        "top_pairs": top_pairs,
        "hourly_distribution": hourly_dist,
        "daily_distribution": daily_dist,
        "night_calls_count": night_calls,
        "night_records_sample": night_records,
        "imei_swaps": imei_swaps,
        "top_locations": {k: int(v) for k, v in top_locations.items()},
        "columns_mapped": {k: str(v) for k, v in col_mapping.items()},
        "sample_records": sample_records
    }
