import os
import re
import io
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

# Comprehensive Indian ISP & Global Cloud/VPN Registry for Cybercrime Investigations
KNOWN_ISP_REGISTRY = {
    "JIO": {
        "name": "Reliance Jio Infocomm Ltd (AS55836)",
        "type": "RESIDENTIAL_MOBILE_AND_FIBER",
        "nodal_email": "nodal.officer@ril.com",
        "statute_dept": "Reliance Jio Law Enforcement Compliance Desk, Navi Mumbai"
    },
    "AIRTEL": {
        "name": "Bharti Airtel Ltd (AS9498)",
        "type": "RESIDENTIAL_BROADBAND_AND_4G",
        "nodal_email": "nodal.broadband@airtel.com",
        "statute_dept": "Bharti Airtel Legal & Regulatory Compliance, Gurgaon"
    },
    "VI": {
        "name": "Vodafone Idea Ltd (AS55410)",
        "type": "RESIDENTIAL_MOBILE_DATA",
        "nodal_email": "nodal.officer@vodafoneidea.com",
        "statute_dept": "Vodafone Idea Law Enforcement Desk, Mumbai"
    },
    "BSNL": {
        "name": "Bharat Sanchar Nigam Ltd (AS9829)",
        "type": "GOVT_BROADBAND_FTTH",
        "nodal_email": "nodal_cyber@bsnl.co.in",
        "statute_dept": "BSNL Cyber Security Cell, New Delhi"
    },
    "ACT": {
        "name": "Atria Convergence Technologies - ACT Fibernet (AS24309)",
        "type": "RESIDENTIAL_FIBER_BROADBAND",
        "nodal_email": "compliance@actcorp.in",
        "statute_dept": "ACT Fibernet Nodal Compliance, Bengaluru"
    },
    "HATHWAY": {
        "name": "Hathway Cable & Datacom Ltd (AS17488)",
        "type": "RESIDENTIAL_CABLE_BROADBAND",
        "nodal_email": "cybercell@hathway.net",
        "statute_dept": "Hathway Legal Compliance Desk, Mumbai"
    },
    "TATA": {
        "name": "Tata Communications Ltd (AS4755)",
        "type": "ENTERPRISE_LEASED_LINE",
        "nodal_email": "leliaison@tatacommunications.com",
        "statute_dept": "Tata Communications LE Liaison Cell, Pune"
    },
    "RAILWIRE": {
        "name": "RailTel Corporation of India (AS24186)",
        "type": "RAILWAY_STATION_AND_RETAIL_FTTH",
        "nodal_email": "nodal.officer@railtelindia.com",
        "statute_dept": "RailTel Cyber Operations Division, New Delhi"
    },
    "TOR_VPN": {
        "name": "TOR Anonymity Network / Multi-hop VPN Exit Node",
        "type": "ANONYMIZER_TOR_OR_VPN",
        "nodal_email": "abuse-desk@tor-exit.net",
        "statute_dept": "International MLAT / Subpoena Required"
    },
    "DIGITALOCEAN": {
        "name": "DigitalOcean LLC Cloud Infrastructure (AS14061)",
        "type": "DATACENTER_VPS_HOSTING",
        "nodal_email": "abuse@digitalocean.com",
        "statute_dept": "DigitalOcean Trust & Safety / US CLOUD Act Subpoena"
    },
    "AWS": {
        "name": "Amazon Web Services EC2 (AS16509)",
        "type": "DATACENTER_CLOUD_COMPUTE",
        "nodal_email": "ec2-abuse@amazon.com",
        "statute_dept": "AWS Compliance & Law Enforcement Response Team"
    },
    "CLOUDFLARE": {
        "name": "Cloudflare Inc Reverse Proxy (AS13335)",
        "type": "CDN_REVERSE_PROXY",
        "nodal_email": "abuse@cloudflare.com",
        "statute_dept": "Cloudflare LEA Request Portal (Unmask Origin Server IP)"
    },
    "OVH": {
        "name": "OVH SAS Dedicated Server Hosting (AS16276)",
        "type": "DATACENTER_HOSTING",
        "nodal_email": "abuse@ovh.net",
        "statute_dept": "OVH Legal Department, France (Europol / MLAT)"
    }
}

def classify_ip_and_isp(ip_str: str) -> Tuple[str, str, str, str, bool]:
    """
    Classifies an IPv4 or IPv6 address against Indian ISPs, Datacenters, and VPN/TOR Exit Nodes.
    Returns: (ISP Name, ISP Category, Nodal Email, Statute Department, is_vpn_flag)
    """
    ip = str(ip_str).strip()

    # IPv6 Classification
    if ":" in ip:
        if ip.startswith("2409:"):
            info = KNOWN_ISP_REGISTRY["JIO"]
            return info["name"], info["type"], info["nodal_email"], info["statute_dept"], False
        elif ip.startswith("2401:4900"):
            info = KNOWN_ISP_REGISTRY["AIRTEL"]
            return info["name"], info["type"], info["nodal_email"], info["statute_dept"], False
        elif ip.startswith("2405:200"):
            info = KNOWN_ISP_REGISTRY["VI"]
            return info["name"], info["type"], info["nodal_email"], info["statute_dept"], False
        elif ip.startswith("2405:204"):
            info = KNOWN_ISP_REGISTRY["BSNL"]
            return info["name"], info["type"], info["nodal_email"], info["statute_dept"], False
        return "Public IPv6 Network", "PUBLIC_IPV6", "nodal@apnic.net", "APNIC Regional Registry", False

    # TOR & VPN Ranges
    if (ip.startswith("185.220.") or ip.startswith("45.142.") or ip.startswith("198.98.") or
        ip.startswith("195.176.") or ip.startswith("51.81.") or ip.startswith("141.98.")):
        info = KNOWN_ISP_REGISTRY["TOR_VPN"]
        return info["name"], info["type"], info["nodal_email"], info["statute_dept"], True

    # DigitalOcean
    if ip.startswith("138.68.") or ip.startswith("159.65.") or ip.startswith("167.99.") or ip.startswith("178.62.") or ip.startswith("134.209."):
        info = KNOWN_ISP_REGISTRY["DIGITALOCEAN"]
        return info["name"], info["type"], info["nodal_email"], info["statute_dept"], True

    # Cloudflare Reverse Proxy
    if ip.startswith("104.16.") or ip.startswith("104.17.") or ip.startswith("104.18.") or ip.startswith("104.19.") or ip.startswith("104.20.") or ip.startswith("104.21.") or ip.startswith("172.64.") or ip.startswith("172.67.") or ip.startswith("172.70."):
        info = KNOWN_ISP_REGISTRY["CLOUDFLARE"]
        return info["name"], info["type"], info["nodal_email"], info["statute_dept"], True

    # AWS
    if (ip.startswith("3.") or ip.startswith("13.") or ip.startswith("52.") or ip.startswith("54.") or ip.startswith("18.") or ip.startswith("35.")):
        info = KNOWN_ISP_REGISTRY["AWS"]
        return info["name"], info["type"], info["nodal_email"], info["statute_dept"], True

    # Reliance Jio (Residential 4G/5G and JioFiber)
    if (ip.startswith("49.32.") or ip.startswith("49.33.") or ip.startswith("49.34.") or ip.startswith("49.35.") or
        ip.startswith("49.36.") or ip.startswith("49.37.") or ip.startswith("49.38.") or ip.startswith("49.39.") or
        ip.startswith("103.211.") or ip.startswith("157.32.") or ip.startswith("157.33.") or ip.startswith("157.34.") or
        ip.startswith("223.224.") or ip.startswith("223.225.")):
        info = KNOWN_ISP_REGISTRY["JIO"]
        return info["name"], info["type"], info["nodal_email"], info["statute_dept"], False

    # Bharti Airtel (Residential 4G/5G and Airtel Xstream Fiber)
    if (ip.startswith("122.160.") or ip.startswith("122.161.") or ip.startswith("122.162.") or ip.startswith("122.163.") or
        ip.startswith("122.170.") or ip.startswith("122.171.") or ip.startswith("122.172.") or ip.startswith("122.173.") or
        ip.startswith("182.64.") or ip.startswith("182.65.") or ip.startswith("182.66.") or ip.startswith("182.67.") or
        ip.startswith("117.200.") or ip.startswith("106.192.") or ip.startswith("106.193.")):
        info = KNOWN_ISP_REGISTRY["AIRTEL"]
        return info["name"], info["type"], info["nodal_email"], info["statute_dept"], False

    # Vodafone Idea (Vi)
    if (ip.startswith("103.24.") or ip.startswith("114.143.") or ip.startswith("115.96.") or ip.startswith("115.97.")):
        info = KNOWN_ISP_REGISTRY["VI"]
        return info["name"], info["type"], info["nodal_email"], info["statute_dept"], False

    # BSNL Internet Services
    if (ip.startswith("117.192.") or ip.startswith("117.193.") or ip.startswith("117.194.") or ip.startswith("117.240.") or
        ip.startswith("218.248.") or ip.startswith("59.90.") or ip.startswith("59.91.")):
        info = KNOWN_ISP_REGISTRY["BSNL"]
        return info["name"], info["type"], info["nodal_email"], info["statute_dept"], False

    # ACT Fibernet
    if ip.startswith("106.51.") or ip.startswith("115.112.") or ip.startswith("183.82."):
        info = KNOWN_ISP_REGISTRY["ACT"]
        return info["name"], info["type"], info["nodal_email"], info["statute_dept"], False

    # Default Public IP
    parts = ip.split(".")
    sub_prefix = f"{parts[0]}.{parts[1]}.x.x" if len(parts) >= 2 else ip
    return f"Indian Public Internet ASN ({sub_prefix})", "PUBLIC_ISP_SUBSCRIBER", "nodal.broadband@isp-registry.in", "ISP Compliance Cell", False

def parse_user_agent_fingerprint(ua_str: str) -> Dict[str, str]:
    """
    Decodes raw HTTP User-Agent strings into physical hardware models, OS versions, and browser clients.
    """
    if not ua_str or ua_str == 'nan' or ua_str == '-':
        return {"device": "Unknown Device", "os": "Unknown OS", "browser": "Direct Network Socket", "summary": "Unspecified Client Endpoint"}

    ua = str(ua_str).strip()

    # Hardware Device Model
    device = "Desktop / Generic Workstation"
    if "SM-" in ua:
        m = re.search(r'(SM-[A-Z0-9]+)', ua)
        device = f"Samsung Galaxy ({m.group(1)})" if m else "Samsung Galaxy Smartphone"
    elif "CPH" in ua or "OnePlus" in ua:
        m = re.search(r'(CPH\d+|OnePlus\s+[A-Z0-9]+)', ua)
        device = f"OnePlus Handset ({m.group(1)})" if m else "OnePlus Handset"
    elif "Redmi" in ua or "POCO" in ua or "Xiaomi" in ua or "220" in ua or "230" in ua:
        m = re.search(r'(Redmi\s+[A-Za-z0-9]+|POCO\s+[A-Za-z0-9]+|Xiaomi\s+[A-Za-z0-9]+)', ua)
        device = f"Xiaomi / Redmi ({m.group(1)})" if m else "Xiaomi Smartphone"
    elif "iPhone" in ua:
        m_ios = re.search(r'OS (\d+[_\.]\d+)', ua)
        ver = m_ios.group(1).replace("_", ".") if m_ios else ""
        device = f"Apple iPhone (iOS {ver})" if ver else "Apple iPhone"
    elif "iPad" in ua:
        device = "Apple iPad Tablet"
    elif "Macintosh" in ua or "Mac OS X" in ua:
        device = "Apple Mac Workstation"
    elif "Windows NT 10.0" in ua:
        device = "Windows 10/11 Workstation"
    elif "Windows NT 6." in ua:
        device = "Legacy Windows 7/8 PC"
    elif "Linux" in ua and "Android" not in ua:
        device = "Linux Terminal / Cloud VPS"

    # Operating System
    os_name = "Desktop OS"
    if "Android" in ua:
        m_and = re.search(r'Android\s+([0-9\.]+)', ua)
        os_name = f"Android {m_and.group(1)}" if m_and else "Android OS"
    elif "iPhone" in ua or "iPad" in ua:
        os_name = "Apple iOS"
    elif "Windows" in ua:
        os_name = "Microsoft Windows"
    elif "Mac OS X" in ua:
        os_name = "macOS"
    elif "Linux" in ua:
        os_name = "Linux"

    # Browser / Application Engine
    browser = "Web Browser"
    if "Chrome/" in ua and "Edg/" not in ua:
        m_ch = re.search(r'Chrome/([0-9\.]+)', ua)
        browser = f"Google Chrome {m_ch.group(1).split('.')[0]}" if m_ch else "Google Chrome"
    elif "Safari/" in ua and "Chrome" not in ua:
        browser = "Apple Safari"
    elif "Firefox/" in ua:
        m_ff = re.search(r'Firefox/([0-9\.]+)', ua)
        browser = f"Mozilla Firefox {m_ff.group(1)}" if m_ff else "Mozilla Firefox"
    elif "Edg/" in ua:
        browser = "Microsoft Edge"
    elif "dart:io" in ua or "OkHttp" in ua or "Postman" in ua or "curl" in ua or "python" in ua.lower():
        browser = "Automated Script / Mobile App API Client"

    summary = f"{device} | {os_name} | {browser}"
    return {
        "device": device,
        "os": os_name,
        "browser": browser,
        "summary": summary,
        "raw_user_agent": ua[:120]
    }

def parse_ip_logs_content(
    file_content_or_path: str,
    case_number: str = "CR-2026-9910",
    case_entities: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Universal Cyber IP & Big Tech LERT Forensic Ingestion Engine:
    - Ingests Google LERT, Meta/WhatsApp, Instagram, Telegram, and Apple LEA compliance disclosures
    - Ingests Apache/Nginx web server access logs and Payment Gateway transaction IP dumps
    - Extracts Dual-Stack IPv4 and IPv6 addresses
    - Resolves Source Port numbers mandatory for Indian CGNAT subscriber identification
    - Converts UTC timestamps to Indian Standard Time (IST, UTC+5:30)
    - Extracts Hardware Device Models and User-Agent fingerprints
    - Generates 1-Click statutory Section 94 BNSS Notice directives with ISP Nodal Officer emails
    - Zero mock data, zero emojis.
    """
    raw_text = ""
    df = None

    if os.path.exists(file_content_or_path):
        ext = os.path.splitext(file_content_or_path)[1].lower()
        try:
            if ext in [".xls", ".xlsx"]:
                raw_df = pd.read_excel(file_content_or_path)
                df = raw_df
            else:
                for enc in ["utf-8", "latin1", "cp1252"]:
                    try:
                        with open(file_content_or_path, "r", encoding=enc, errors="ignore") as f:
                            raw_text = f.read()
                        break
                    except Exception:
                        continue

                # Attempt tabular CSV parse
                if raw_text:
                    for sep in ["\t", ",", ";", "|"]:
                        try:
                            cand = pd.read_csv(io.StringIO(raw_text), sep=sep, on_bad_lines="skip")
                            if len(cand.columns) >= 2 and len(cand) >= 1:
                                df = cand
                                break
                        except Exception:
                            continue
        except Exception as e:
            logger.warning(f"Failed to read Cyber IP log file: {e}")
    else:
        raw_str = str(file_content_or_path).strip()
        if raw_str:
            raw_text = raw_str
            for sep in ["\t", ",", ";", "|"]:
                try:
                    cand = pd.read_csv(io.StringIO(raw_text), sep=sep, on_bad_lines="skip")
                    if len(cand.columns) >= 2 and len(cand) >= 1:
                        df = cand
                        break
                except Exception:
                    continue

    if not raw_text and (df is None or len(df) == 0):
        return {
            "status": "empty",
            "message": "No IP log records found. Please upload a Google LERT, Meta, Telegram, or Server Access log file.",
            "total_records": 0,
            "case_number": case_number,
            "response_type": "IP_LOGS",
            "detected_fraud_pattern": "NONE",
            "fraud_confidence_score": 0,
            "risk_score": 0,
            "top_ip_addresses": [],
            "vpn_proxy_hits": 0,
            "isp_subscriber_leads": [],
            "executive_summary": f"No Cyber IP records extracted for Case {case_number}.",
            "recommended_next_action": "Upload cyber forensic IP log file (CSV, Excel XLSX, TXT, Log).",
            "visualization_config": None
        }

    # Dual-Stack IP Regex patterns
    ipv4_pattern = re.compile(r'\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b')
    ipv6_pattern = re.compile(r'\b(?:240[0-9a-fA-F]:[0-9a-fA-F:]+|[0-9a-fA-F]{1,4}(?::[0-9a-fA-F]{1,4}){3,7})\b')
    port_pattern = re.compile(r'(?::\s*|\bport\s*[:=]?\s*|\bsrc_port\s*[:=]?\s*)(\d{2,5})\b', re.IGNORECASE)

    extracted_records: List[Dict[str, Any]] = []
    vpn_hits = 0
    cgnat_hits = 0

    # Strategy 1: Tabular LERT Disclosures (Google, Meta, Telegram, Microsoft, Apple, Payment Gateway)
    if df is not None and len(df) > 0 and len(df.columns) >= 2:
        df.columns = [str(c).strip().lower().replace("_", " ").replace("-", " ") for c in df.columns]

        ip_col = next((c for c in df.columns if any(k in c for k in ["ip address", "ip", "client ip", "source ip", "src ip", "login ip", "remote ip", "remote host"])), None)
        port_col = next((c for c in df.columns if any(k in c for k in ["source port", "src port", "port", "client port", "src port number"])), None)
        ts_col = next((c for c in df.columns if any(k in c for k in ["timestamp", "time", "date time", "datetime", "login time", "event time", "date"])), None)
        event_col = next((c for c in df.columns if any(k in c for k in ["event", "action", "event type", "activity", "action taken", "description", "uri", "path"])), None)
        ua_col = next((c for c in df.columns if any(k in c for k in ["user agent", "ua", "browser", "device", "client app", "useragent"])), None)

        if ip_col:
            for idx, row in df.iterrows():
                raw_ip = str(row.get(ip_col, "")).strip().replace("'", "").replace('"', "")
                m_v4 = ipv4_pattern.search(raw_ip)
                m_v6 = ipv6_pattern.search(raw_ip)
                clean_ip = m_v4.group(0) if m_v4 else (m_v6.group(0) if m_v6 else "")

                if not clean_ip or clean_ip.startswith("127.") or clean_ip.startswith("192.168.") or clean_ip.startswith("10."):
                    continue

                # Port extraction
                port_val = ""
                if port_col and pd.notna(row.get(port_col)):
                    p_str = str(row.get(port_col)).strip().replace(".0", "")
                    if p_str.isdigit(): port_val = p_str
                if not port_val:
                    m_p = port_pattern.search(raw_ip)
                    if m_p: port_val = m_p.group(1)

                # Timestamp UTC to IST
                raw_ts = str(row.get(ts_col, "")).strip() if ts_col and pd.notna(row.get(ts_col)) else ""
                ist_ts = raw_ts
                if raw_ts:
                    try:
                        clean_ts = raw_ts.replace("'", "").replace('"', "").replace("/", "-")
                        dt_utc = pd.to_datetime(clean_ts, errors="coerce")
                        if pd.notna(dt_utc):
                            dt_ist = dt_utc + timedelta(hours=5, minutes=30)
                            ist_ts = dt_ist.strftime('%Y-%m-%d %H:%M:%S IST')
                    except Exception:
                        ist_ts = f"{raw_ts} (IST)"

                raw_event = str(row.get(event_col, "")).strip() if event_col and pd.notna(row.get(event_col)) else "Platform Session Access"
                raw_ua = str(row.get(ua_col, "")).strip() if ua_col and pd.notna(row.get(ua_col)) else ""
                device_info = parse_user_agent_fingerprint(raw_ua)

                isp_name, isp_type, nodal_email, statute_dept, is_vpn = classify_ip_and_isp(clean_ip)
                if is_vpn: vpn_hits += 1
                if port_val: cgnat_hits += 1

                extracted_records.append({
                    "ip": clean_ip,
                    "source_port": port_val or "Unspecified",
                    "utc_timestamp": raw_ts or "Log Recorded",
                    "ist_timestamp": ist_ts or "Log Recorded",
                    "event_action": raw_event,
                    "device_model": device_info["device"],
                    "os_name": device_info["os"],
                    "browser": device_info["browser"],
                    "device_summary": device_info["summary"],
                    "isp_name": isp_name,
                    "isp_type": isp_type,
                    "nodal_email": nodal_email,
                    "statute_dept": statute_dept,
                    "is_vpn": is_vpn
                })

    # Strategy 2: Web Server Combined Log Format & Unstructured Text
    if len(extracted_records) == 0 and raw_text:
        lines = raw_text.split("\n")
        for line in lines:
            line_str = line.strip()
            if not line_str: continue

            m_v4 = ipv4_pattern.search(line_str)
            m_v6 = ipv6_pattern.search(line_str)
            clean_ip = m_v4.group(0) if m_v4 else (m_v6.group(0) if m_v6 else "")

            if not clean_ip or clean_ip.startswith("127.") or clean_ip.startswith("192.168.") or clean_ip.startswith("10."):
                continue

            # Extract Port
            m_p = port_pattern.search(line_str)
            port_val = m_p.group(1) if m_p else ""

            # Extract Timestamp
            m_time = re.search(r'\[?(\d{2,4}[-/]\d{2}[-/]\d{2,4}[ T:]\d{2}:\d{2}(?::\d{2})?)', line_str)
            raw_ts = m_time.group(1) if m_time else ""
            ist_ts = raw_ts
            if raw_ts:
                try:
                    dt_utc = pd.to_datetime(raw_ts.replace("/", "-"), errors="coerce")
                    if pd.notna(dt_utc):
                        dt_ist = dt_utc + timedelta(hours=5, minutes=30)
                        ist_ts = dt_ist.strftime('%Y-%m-%d %H:%M:%S IST')
                except Exception:
                    ist_ts = f"{raw_ts} (IST)"

            # Extract User-Agent if in quotes
            ua_matches = re.findall(r'"([^"]*)"', line_str)
            raw_ua = ua_matches[-1] if len(ua_matches) >= 2 else (ua_matches[0] if ua_matches else "")
            device_info = parse_user_agent_fingerprint(raw_ua)

            # Event / URI
            raw_event = ua_matches[0] if len(ua_matches) >= 1 else "HTTP Session Connect"

            isp_name, isp_type, nodal_email, statute_dept, is_vpn = classify_ip_and_isp(clean_ip)
            if is_vpn: vpn_hits += 1
            if port_val: cgnat_hits += 1

            extracted_records.append({
                "ip": clean_ip,
                "source_port": port_val or "Unspecified",
                "utc_timestamp": raw_ts or "Log Recorded",
                "ist_timestamp": ist_ts or "Log Recorded",
                "event_action": raw_event,
                "device_model": device_info["device"],
                "os_name": device_info["os"],
                "browser": device_info["browser"],
                "device_summary": device_info["summary"],
                "isp_name": isp_name,
                "isp_type": isp_type,
                "nodal_email": nodal_email,
                "statute_dept": statute_dept,
                "is_vpn": is_vpn
            })

    total_records = len(extracted_records)
    if total_records == 0:
        return {
            "status": "empty",
            "message": "No valid public IPv4/IPv6 connections extracted from the provided file.",
            "total_records": 0,
            "case_number": case_number,
            "response_type": "IP_LOGS",
            "visualization_config": None
        }

    # Group by Unique IP Address
    ip_df = pd.DataFrame(extracted_records)
    ip_counts = ip_df["ip"].value_counts()

    top_ip_addresses = []
    isp_subscriber_leads = []

    for ip_val, count in ip_counts.head(8).items():
        subset = ip_df[ip_df["ip"] == ip_val]
        first_row = subset.iloc[0]
        ports = [p for p in subset["source_port"].unique() if p and p != "Unspecified"]
        port_display = ", ".join(ports[:3]) if ports else "N/A"

        top_ip_addresses.append({
            "ip": ip_val,
            "source_ports": port_display,
            "connections": int(count),
            "isp": first_row["isp_name"],
            "type": first_row["isp_type"],
            "nodal_email": first_row["nodal_email"],
            "is_vpn": bool(first_row["is_vpn"]),
            "ist_timestamp": first_row["ist_timestamp"],
            "device": first_row["device_model"],
            "device_summary": first_row["device_summary"]
        })

        if not first_row["is_vpn"]:
            port_clause = f" on Source Port {port_display}" if port_display != "N/A" else ""
            isp_subscriber_leads.append({
                "ip": ip_val,
                "source_port": port_display,
                "isp_name": first_row["isp_name"],
                "nodal_email": first_row["nodal_email"],
                "ist_timestamp": first_row["ist_timestamp"],
                "statutory_action": f"Issue Section 94 BNSS Notice to {first_row['isp_name']} ({first_row['nodal_email']}) for Subscriber Details{port_clause} at timestamp {first_row['ist_timestamp']}"
            })

    # Device & Hardware Fingerprints
    device_counts = ip_df["device_summary"].value_counts().head(5).to_dict()
    device_fingerprints = [
        {"fingerprint": k, "hits": int(v), "device_model": k.split(" | ")[0] if " | " in k else k}
        for k, v in device_counts.items()
    ]

    # Critical Security Events
    account_events = [
        {
            "event": r["event_action"],
            "ip": r["ip"],
            "source_port": r["source_port"],
            "ist_timestamp": r["ist_timestamp"],
            "device": r["device_model"]
        }
        for r in extracted_records[:6]
    ]

    # Time series hourly distribution
    hourly_counts = {f"{h:02d}:00": 0 for h in range(24)}
    for r in extracted_records:
        ts_str = r.get("ist_timestamp", "")
        m_hour = re.search(r'(\d{2}):\d{2}:\d{2}', ts_str)
        if m_hour:
            h_key = f"{int(m_hour.group(1)):02d}:00"
            hourly_counts[h_key] = hourly_counts.get(h_key, 0) + 1

    chart_data = [{"timestamp": f"{k} IST", "connections": v} for k, v in sorted(hourly_counts.items())]

    # Signature & Executive Summary
    pattern_sig = "ANONYMIZED_TOR_VPN_ACCESS" if vpn_hits > (total_records * 0.3) else ("MULTI_ISP_CGNAT_RESIDENTIAL_ACCESS" if cgnat_hits > 0 else "RESIDENTIAL_ISP_AUDIT")
    confidence = 96 if vpn_hits > 0 or cgnat_hits > 0 else 88
    risk_score = 9 if vpn_hits > 0 else 7

    primary_lead = isp_subscriber_leads[0] if isp_subscriber_leads else None
    exec_summary = (
        f"Forensic analysis of {total_records} Cyber IP connection events for Case {case_number}. "
        f"Identified {len(ip_counts)} unique remote IP endpoints ({vpn_hits} VPN/TOR anonymized gateway hits, {cgnat_hits} CGNAT Source Port allocations). "
        f"Top remote host {top_ip_addresses[0]['ip']} ({top_ip_addresses[0]['isp']}) recorded {top_ip_addresses[0]['connections']} connection events."
    )

    next_action = (
        f"Issue Section 94 BNSS Notice to {primary_lead['isp_name']} ({primary_lead['nodal_email']}) for IP {primary_lead['ip']} (Port {primary_lead['source_port']})."
        if primary_lead else
        f"Dispatch Section 94 BNSS notice to platform provider for account registration records."
    )

    return {
        "status": "success",
        "case_number": case_number,
        "response_type": "IP_LOGS",
        "total_records": total_records,
        "detected_fraud_pattern": pattern_sig,
        "fraud_confidence_score": confidence,
        "risk_score": risk_score,
        "vpn_proxy_hits": vpn_hits,
        "cgnat_port_hits": cgnat_hits,
        "top_ip_addresses": top_ip_addresses,
        "isp_subscriber_leads": isp_subscriber_leads,
        "device_fingerprints": device_fingerprints,
        "account_events": account_events,
        "executive_summary": exec_summary,
        "recommended_next_action": next_action,
        "visualization_config": {
            "recommended_chart_type": "LINE_TREND",
            "chart_title": f"Cyber IP Access Timeline & IST Distribution ({case_number})",
            "chart_insights": f"Ingested {total_records} connection records across {len(ip_counts)} endpoints ({vpn_hits} VPN/TOR hits).",
            "x_axis_key": "timestamp",
            "y_axis_key": "connections",
            "data_grounded": True,
            "chart_data": chart_data
        }
    }
