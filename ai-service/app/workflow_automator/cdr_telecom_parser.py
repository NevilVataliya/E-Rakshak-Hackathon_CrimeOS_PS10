import os
import re
import io
import json
import logging
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd
import numpy as np
import networkx as nx

logger = logging.getLogger(__name__)

def clean_phone_number(val: Any) -> str:
    if pd.isna(val):
        return ""
    val_str = str(val).strip().replace(".0", "").replace(" ", "").replace("-", "").replace("+", "").replace("'", "").replace('"', "")
    if len(val_str) > 10 and val_str.startswith("91"):
        val_str = val_str[2:]
    return val_str

def clean_imei(val: Any) -> str:
    if pd.isna(val):
        return ""
    val_str = str(val).strip().replace("'", "").replace('"', "").replace(" ", "").replace(".0", "")
    return val_str

def _scan_cdr_table_start(raw_text: str) -> Tuple[int, Optional[str], str, str]:
    """
    Forensic pre-header scanner for Indian Telecom CDRs (Bharti Airtel PAN India, Reliance Jio, Vi, BSNL).
    Detects table start line, column separator (Tab / Comma), telecom operator, and Target Mobile Number.
    """
    lines = raw_text.split("\n")
    operator = "Telecom Operator"
    target_no = ""

    for idx, line in enumerate(lines[:45]):
        line_clean = line.strip()
        if not line_clean:
            continue

        # Extract Telecom Operator
        line_upper = line_clean.upper()
        if "BHARTI AIRTEL" in line_upper:
            operator = "Bharti Airtel Limited"
        elif "RELIANCE JIO" in line_upper or "RJIL" in line_upper:
            operator = "Reliance Jio Infocomm Ltd"
        elif "VODAFONE" in line_upper or "IDEA" in line_upper or "VODAFONE IDEA" in line_upper:
            operator = "Vodafone Idea Ltd (Vi)"
        elif "BSNL" in line_upper or "BHARAT SANCHAR" in line_upper:
            operator = "Bharat Sanchar Nigam Ltd (BSNL)"

        # Extract Target / Subject Mobile Number
        m_tgt = re.search(r'(?:Mobile No|Target No|MSISDN|Sub No|Phone No|Subscriber)\s*[\':=]?\s*[\'"]?(\d{10,12})[\'"]?', line_clean, re.IGNORECASE)
        if m_tgt and not target_no:
            target_no = m_tgt.group(1)

        # Detect Table Header Row
        line_lower = line_clean.lower()
        has_party = any(p in line_lower for p in ["target no", "calling", "called", "b party", "msisdn", "phone number", "target", "a party"])
        has_time = any(p in line_lower for p in ["date", "time", "timestamp", "dur", "call type", "service type", "toc", "day calls", "eve calls", "night calls"])

        if has_party and has_time:
            for sep in ["\t", ",", ";", "|"]:
                if len(line_clean.split(sep)) >= 3:
                    return idx, sep, operator, target_no
            return idx, None, operator, target_no

    return 0, None, operator, target_no

def parse_cdr_content(
    file_content_or_path: str,
    case_number: str = "CR-2026-9910",
    case_entities: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Forensic Telecom CDR Ingestion Engine supporting:
    - Bharti Airtel PAN India LEA Format (Target No, B Party No, CGI Lat/Long, VoWiFi IP, IMEI, IMSI)
    - Reliance Jio, Vodafone Idea (Vi), and BSNL LEA CDR Formats
    - Separation of Human Contacts vs Banking/Service SMS Headers
    - Geospatial Cell Tower coordinates extraction with frequency counts
    - Dual-SIM vs Device-Swap classification
    - Voice-over-Wi-Fi (VoWiFi) IP broadband subscriber lead generation
    - NetworkX caller-receiver accomplice link analysis
    - Zero mock datasets, zero emojis.
    """
    df = None
    telecom_metadata = {"operator": "Telecom Operator", "target_number": ""}

    if os.path.exists(file_content_or_path):
        ext = os.path.splitext(file_content_or_path)[1].lower()
        try:
            if ext in [".xls", ".xlsx"]:
                raw_df = pd.read_excel(file_content_or_path)
                h_idx = None
                for r_i in range(min(45, len(raw_df))):
                    r_str = " ".join([str(x).lower() for x in raw_df.iloc[r_i].values if pd.notna(x)])
                    if any(p in r_str for p in ["target no", "calling", "b party", "msisdn"]) and any(p in r_str for p in ["date", "time", "dur", "call type"]):
                        h_idx = r_i
                        break
                if h_idx is not None:
                    raw_df.columns = [str(c).strip() for c in raw_df.iloc[h_idx].values]
                    df = raw_df.iloc[h_idx + 1:].reset_index(drop=True)
                else:
                    df = raw_df
            else:
                raw_text = ""
                for enc in ["utf-8", "latin1", "cp1252"]:
                    try:
                        with open(file_content_or_path, "r", encoding=enc, errors="ignore") as f:
                            raw_text = f.read()
                        break
                    except Exception:
                        continue

                if raw_text:
                    h_idx, sep, oper, tgt = _scan_cdr_table_start(raw_text)
                    telecom_metadata["operator"] = oper
                    if tgt: telecom_metadata["target_number"] = tgt

                    sliced = "\n".join(raw_text.split("\n")[h_idx:])
                    seps_to_try = [sep] if sep else ["\t", ",", ";", "|"]
                    for s in seps_to_try:
                        if not s: continue
                        try:
                            cand = pd.read_csv(io.StringIO(sliced), sep=s, on_bad_lines="skip")
                            if len(cand.columns) >= 2 and len(cand) >= 1:
                                df = cand
                                break
                        except Exception:
                            continue
        except Exception as e:
            logger.warning(f"Failed to read CDR file: {e}")
    else:
        raw_str = str(file_content_or_path).strip()
        if raw_str:
            h_idx, sep, oper, tgt = _scan_cdr_table_start(raw_str)
            telecom_metadata["operator"] = oper
            if tgt: telecom_metadata["target_number"] = tgt

            sliced = "\n".join(raw_str.split("\n")[h_idx:])
            seps_to_try = [sep] if sep else ["\t", ",", ";", "|"]
            for s in seps_to_try:
                if not s: continue
                try:
                    cand = pd.read_csv(io.StringIO(sliced), sep=s, on_bad_lines="skip")
                    if len(cand.columns) >= 2 and len(cand) >= 1:
                        df = cand
                        break
                except Exception:
                    continue

    if df is None or len(df) == 0:
        return {
            "status": "empty",
            "message": "No valid telecom CDR records found.",
            "total_records": 0,
            "case_number": case_number,
            "response_type": "CDR",
            "detected_fraud_pattern": "NONE",
            "fraud_confidence_score": 0,
            "risk_score": 0,
            "night_calls_count": 0,
            "top_b_parties": [],
            "linked_service_headers": [],
            "top_tower_locations": [],
            "geo_tower_locations": [],
            "vowifi_ip_leads": [],
            "imei_history": [],
            "imei_swap_leads": [],
            "executive_summary": f"No CDR records extracted for Case {case_number}.",
            "recommended_next_action": "Upload telecom CDR dump (.csv, .tsv, .xlsx).",
            "visualization_config": None
        }

    # Clean headers
    df.columns = [str(c).strip().lower().replace("_", " ").replace("-", " ") for c in df.columns]

    # Mode 1: Aggregated Billing CDR (Day/Eve/Night/Intl Calls)
    agg_night = next((c for c in df.columns if "night calls" in c or "night mins" in c or "night" in c), None)
    agg_day = next((c for c in df.columns if "day calls" in c or "day mins" in c), None)
    phone_col = next((c for c in df.columns if any(k in c for k in ["phone", "msisdn", "target", "calling"])), None)

    if agg_night and agg_day and phone_col and "b party" not in " ".join(df.columns):
        total_records = len(df)
        df[agg_night] = pd.to_numeric(df[agg_night], errors="coerce").fillna(0)
        if agg_day: df[agg_day] = pd.to_numeric(df[agg_day], errors="coerce").fillna(0)
        total_night_calls = int(df[agg_night].sum())

        top_night_bursts = df.sort_values(by=agg_night, ascending=False).head(5)
        top_suspect_phones = []
        for idx, row in top_night_bursts.iterrows():
            p_val = clean_phone_number(row[phone_col])
            n_count = int(row[agg_night])
            if p_val and n_count > 0:
                top_suspect_phones.append({
                    "party": f"+91 {p_val[:5]} {p_val[5:]}" if len(p_val) == 10 else p_val,
                    "count": n_count,
                    "risk_flag": "HIGH_MIDNIGHT_CALL_BURST"
                })

        return {
            "status": "success",
            "case_number": case_number,
            "response_type": "CDR",
            "telecom_operator": telecom_metadata["operator"],
            "total_records": total_records,
            "detected_fraud_pattern": "MIDNIGHT_ANOMALY_BURSTS" if total_night_calls > 10 else "STANDARD_TELECOM_ACTIVITY",
            "fraud_confidence_score": 92 if total_night_calls > 10 else 75,
            "risk_score": 8 if total_night_calls > 10 else 4,
            "night_calls_count": total_night_calls,
            "top_b_parties": top_suspect_phones,
            "linked_service_headers": [],
            "top_tower_locations": [],
            "geo_tower_locations": [],
            "vowifi_ip_leads": [],
            "imei_history": [],
            "imei_swap_leads": [],
            "executive_summary": f"Ingested {total_records} aggregated subscriber records from {telecom_metadata['operator']}. Identified {total_night_calls} total midnight window call events.",
            "recommended_next_action": "Issue Section 94 BNSS Notice to obtain granular call event records for top midnight suspect numbers.",
            "visualization_config": {
                "recommended_chart_type": "HOURLY_ACTIVITY_BAR",
                "chart_title": f"Aggregated Subscriber Activity ({case_number})",
                "chart_insights": f"Total records: {total_records} | Midnight burst events: {total_night_calls}",
                "data_grounded": True,
                "chart_data": [{"hour": f"Suspect #{i+1}", "count": item["count"]} for i, item in enumerate(top_suspect_phones)]
            }
        }

    # Mode 2: Event-Level CDR Logs (Bharti Airtel PAN India / Jio / Vi / BSNL)
    a_col = next((c for c in df.columns if any(k in c for k in ["target no", "calling", "a party", "msisdn", "originating", "src", "from", "caller", "a number"])), None)
    b_col = next((c for c in df.columns if any(k in c for k in ["b party no", "b party", "called no", "called number", "called", "destination", "dest", "other party", "dialed", "b number", "to number"])), None)
    date_col = next((c for c in df.columns if c in ["date", "call date", "start date", "event date"]), None)
    time_col = next((c for c in df.columns if c in ["time", "call time", "start time", "event time"]), None)
    dt_col = next((c for c in df.columns if any(k in c for k in ["date time", "datetime", "timestamp", "start time"])), None)
    dur_col = next((c for c in df.columns if any(k in c for k in ["dur(s)", "duration", "dur", "length", "call duration"])), None)
    imei_col = next((c for c in df.columns if any(k in c for k in ["imei", "handset", "device", "tac"])), None)
    imsi_col = next((c for c in df.columns if any(k in c for k in ["imsi", "sim"])), None)
    cgi_col = next((c for c in df.columns if c in ["first cgi", "cell id", "first cell id", "tower", "cgi", "site", "last cgi"]), None)
    latlong_col = next((c for c in df.columns if any(k in c for k in ["first cgi lat/long", "first cgi lat", "lat/long", "lat long", "coordinates"])), None)
    vowifi_col = next((c for c in df.columns if any(k in c for k in ["vowifi first ue ip", "vowifi last ue ip", "ue ip", "vowifi ip", "ip address"])), None)

    if not a_col and len(df.columns) > 0: a_col = df.columns[0]
    if not b_col and len(df.columns) > 3: b_col = df.columns[3]
    elif not b_col and len(df.columns) > 1: b_col = df.columns[1]

    standard_df = pd.DataFrame()
    standard_df["a_number"] = df[a_col].apply(clean_phone_number) if a_col else ""
    standard_df["raw_b_number"] = df[b_col].fillna("").astype(str).str.strip() if b_col else ""
    standard_df["b_number"] = standard_df["raw_b_number"].apply(clean_phone_number)

    # Timestamp evaluation
    if date_col and time_col:
        combined_ts = df[date_col].astype(str).str.replace("'", "").str.replace('"', "") + " " + df[time_col].astype(str).str.replace("'", "").str.replace('"', "")
        standard_df["timestamp"] = pd.to_datetime(combined_ts, errors="coerce", dayfirst=True)
    elif dt_col:
        standard_df["timestamp"] = pd.to_datetime(df[dt_col].astype(str).str.replace("'", ""), errors="coerce", dayfirst=True)
    elif date_col:
        standard_df["timestamp"] = pd.to_datetime(df[date_col].astype(str).str.replace("'", ""), errors="coerce", dayfirst=True)
    else:
        standard_df["timestamp"] = pd.NaT

    standard_df["duration"] = pd.to_numeric(df[dur_col], errors="coerce").fillna(0) if dur_col else 0
    standard_df["imei"] = df[imei_col].apply(clean_imei) if imei_col else ""
    standard_df["imsi"] = df[imsi_col].apply(clean_imei) if imsi_col else ""
    standard_df["tower"] = df[cgi_col].fillna("").astype(str).str.strip().str.replace("'", "").str.replace('"', "") if cgi_col else ""
    standard_df["lat_long"] = df[latlong_col].fillna("").astype(str).str.strip().str.replace("'", "").str.replace('"', "") if latlong_col else ""
    standard_df["vowifi_ip"] = df[vowifi_col].fillna("").astype(str).str.strip().str.replace("'", "").str.replace('"', "") if vowifi_col else ""

    # Filter out empty records
    standard_df = standard_df[~((standard_df["a_number"] == "") & (standard_df["raw_b_number"] == ""))]
    total_records = len(standard_df)

    if total_records == 0:
        return {
            "status": "empty",
            "message": "Uploaded CDR contained no valid call event rows.",
            "total_records": 0,
            "case_number": case_number,
            "response_type": "CDR",
            "visualization_config": None
        }

    # 1. Accomplice Link Analysis vs Service Headers Separation
    G = nx.DiGraph()
    target_subject = telecom_metadata["target_number"] or (standard_df["a_number"].iloc[0] if len(standard_df) > 0 else "Subject")
    G.add_node(target_subject, type="TARGET_PHONE")

    human_contacts: Dict[str, int] = {}
    service_headers: Dict[str, int] = {}

    for idx, row in standard_df.iterrows():
        raw_b = str(row["raw_b_number"]).strip().replace("'", "").replace('"', "")
        if not raw_b or raw_b == "nan" or raw_b == "-": continue

        clean_digits = re.sub(r'\D', '', raw_b)
        if len(clean_digits) in [10, 11, 12]:
            p_10 = clean_digits[-10:]
            human_contacts[p_10] = human_contacts.get(p_10, 0) + 1
        else:
            service_headers[raw_b] = service_headers.get(raw_b, 0) + 1

    top_b_parties = []
    for p_num, count in sorted(human_contacts.items(), key=lambda x: x[1], reverse=True)[:5]:
        formatted = f"+91 {p_num[:5]} {p_num[5:]}"
        top_b_parties.append({
            "party": formatted,
            "count": count,
            "risk_flag": "HIGH_FREQUENCY_ACCOMPLICE" if count >= 3 else "STANDARD_CONTACT"
        })
        G.add_node(formatted, type="ACCOMPLICE_PHONE")
        G.add_edge(target_subject, formatted, weight=count, type="CALL_EVENT")

    linked_service_headers = [
        {"header": h, "sms_count": c, "category": "BANKING_OTP_OR_SERVICE" if any(b in h.upper() for b in ["BNK", "BANK", "PAY", "OTP", "YES", "HDFC", "SBI", "ICICI", "AXIS"]) else "TELECOM_SERVICE"}
        for h, c in sorted(service_headers.items(), key=lambda x: x[1], reverse=True)[:6]
    ]

    # 2. IMEI Multi-SIM & Handset Swapping Forensics
    unique_imeis = [x for x in standard_df["imei"].unique() if x and x != "nan" and len(x) >= 8]
    imei_history = [{"imei": imei, "first_seen": "Case Ingestion", "last_seen": "Active"} for imei in unique_imeis]
    imei_swap_leads = []

    if len(unique_imeis) > 1:
        for imei in unique_imeis:
            m_df = standard_df[standard_df["imei"] == imei]
            linked_sims = list(m_df["a_number"].unique())
            first_ts = str(m_df["timestamp"].dropna().iloc[0]) if not m_df["timestamp"].dropna().empty else "Recorded Event"

            # Check if this is a Dual-SIM Slot variation of another IMEI
            is_dualsim_slot = any(other != imei and other[:13] == imei[:13] for other in unique_imeis)
            lead_label = "Dual-SIM Handset (Slot variation)" if is_dualsim_slot else "Burner Handset Switch"

            imei_swap_leads.append({
                "imei": imei,
                "device_classification": lead_label,
                "linked_sim_count": len(linked_sims),
                "sim_count": len(linked_sims),
                "linked_sims": linked_sims,
                "associated_numbers": linked_sims,
                "call_count": len(m_df),
                "first_detected": first_ts,
                "statutory_action": f"Issue CEIR Handset Trace & Section 94 BNSS Subpoena for IMEI {imei}"
            })

    # 3. Geospatial Tower Mapping (Slash & Comma support)
    geo_map: Dict[str, Dict[str, Any]] = {}
    tower_counts: Dict[str, int] = {}

    for idx, r in standard_df.iterrows():
        t_id = str(r["tower"]) if r["tower"] and r["tower"] != "nan" else f"Tower-LOC-{idx+1}"
        coords = str(r["lat_long"]).strip()
        if coords and coords != "nan" and ("/" in coords or "," in coords):
            try:
                parts = coords.split("/") if "/" in coords else coords.split(",")
                lat_val = float(parts[0].strip())
                lng_val = float(parts[1].strip())
                key = f"{lat_val:.5f},{lng_val:.5f}"
                if key not in geo_map:
                    geo_map[key] = {
                        "tower_id": t_id,
                        "lat": lat_val,
                        "lng": lng_val,
                        "frequency": 1,
                        "timestamp": str(r["timestamp"]) if pd.notna(r["timestamp"]) else ""
                    }
                else:
                    geo_map[key]["frequency"] += 1
            except Exception:
                pass

        if t_id and t_id != "nan":
            tower_counts[t_id] = tower_counts.get(t_id, 0) + 1

    geo_towers = sorted(geo_map.values(), key=lambda x: x["frequency"], reverse=True)[:8]

    top_towers = [
        {"location": k, "frequency": v, "lead_type": "PRIMARY_TOWER_ZONE"}
        for k, v in sorted(tower_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    ]

    # 4. Voice-over-Wi-Fi (VoWiFi) IP Broadband Leads
    vowifi_leads = []
    seen_ips = set()
    for idx, r in standard_df.iterrows():
        ip = str(r["vowifi_ip"]).strip()
        if ip and ip != "nan" and "." in ip and ip not in seen_ips:
            seen_ips.add(ip)
            vowifi_leads.append({
                "vowifi_ip": ip,
                "timestamp": str(r["timestamp"]) if pd.notna(r["timestamp"]) else "Call Event",
                "statutory_action": f"Issue Section 94 BNSS Notice to ISP for Broadband Subscriber using VoWiFi IP {ip}"
            })

    # 5. Midnight Anomaly Burst Window (10 PM to 6 AM)
    night_calls_count = 0
    if not standard_df["timestamp"].isna().all():
        valid_ts = standard_df[standard_df["timestamp"].notna()]
        night_calls_count = int(valid_ts["timestamp"].dt.hour.apply(lambda h: 1 if (h >= 22 or h < 6) else 0).sum())

    # 6. Pattern Signature Detection
    detected_pattern = "STANDARD_TELECOM_ACTIVITY"
    confidence = 82
    risk_score = 5

    if len(imei_swap_leads) > 0 and night_calls_count > 0:
        detected_pattern = "MULTI_SIM_IMEI_SWAPPING_AND_MIDNIGHT_ANOMALY"
        confidence = 96
        risk_score = 9
    elif len(imei_swap_leads) > 0:
        detected_pattern = "MULTI_SIM_IMEI_SWAPPING"
        confidence = 94
        risk_score = 8
    elif night_calls_count > 0:
        detected_pattern = "MIDNIGHT_ANOMALY_BURSTS"
        confidence = 90
        risk_score = 7

    target_display = telecom_metadata["target_number"] or target_subject
    exec_summary = (
        f"Forensic analysis of {total_records} CDR records from {telecom_metadata['operator']} for Target {target_display}. "
        f"Detected {len(unique_imeis)} handsets ({len(imei_swap_leads)} swap leads), "
        f"{night_calls_count} midnight anomaly window calls, {len(geo_map)} geo-located cell towers, "
        f"{len(linked_service_headers)} linked bank/telecom SMS channels, and {len(vowifi_leads)} VoWiFi broadband subscriber leads."
    )

    primary_accomplice = top_b_parties[0]["party"] if top_b_parties else None
    next_action = (
        f"Execute Section 94 BNSS Notice for primary accomplice {primary_accomplice} ({top_b_parties[0]['count']} calls) and CEIR Handset Subpoena for IMEI {unique_imeis[0]}."
        if primary_accomplice and unique_imeis else
        f"Dispatch Section 94 BNSS statutory notice to {telecom_metadata['operator']}."
    )

    # Hourly histogram data
    hourly_histogram = []
    if not standard_df["timestamp"].isna().all():
        h_counts = standard_df["timestamp"].dt.hour.value_counts().to_dict()
        hourly_histogram = [{"hour": f"{h:02d}:00", "count": int(h_counts.get(h, 0))} for h in range(24)]
    else:
        hourly_histogram = [{"hour": f"Contact #{i+1}", "count": item["count"]} for i, item in enumerate(top_b_parties)]

    return {
        "status": "success",
        "case_number": case_number,
        "response_type": "CDR",
        "telecom_operator": telecom_metadata["operator"],
        "target_mobile_number": target_display,
        "total_records": total_records,
        "detected_fraud_pattern": detected_pattern,
        "fraud_confidence_score": confidence,
        "risk_score": risk_score,
        "night_calls_count": night_calls_count,
        "top_b_parties": top_b_parties,
        "linked_service_headers": linked_service_headers,
        "top_tower_locations": top_towers,
        "geo_tower_locations": geo_towers,
        "vowifi_ip_leads": vowifi_leads,
        "imei_history": imei_history,
        "imei_swap_leads": imei_swap_leads,
        "network_graph": {
            "nodes": [{"id": n, "type": G.nodes[n].get("type", "PHONE")} for n in G.nodes()],
            "edges": [{"source": u, "target": v, "weight": G.edges[u,v].get("weight", 1)} for u, v in G.edges()]
        },
        "executive_summary": exec_summary,
        "recommended_next_action": next_action,
        "visualization_config": {
            "recommended_chart_type": "HOURLY_ACTIVITY_BAR",
            "chart_title": f"CDR Call Activity Timeline ({target_display})",
            "chart_insights": f"Ingested {total_records} records from {telecom_metadata['operator']}: {night_calls_count} midnight burst events across {len(unique_imeis)} handsets.",
            "data_grounded": True,
            "chart_data": hourly_histogram
        }
    }
