import json
import urllib.request
import urllib.error
from typing import Dict, Any, Optional

def call_gemini(prompt: str, api_key: str) -> str:
    """
    Calls Gemini using active Flash-Lite & Flash models with automatic quota failover.
    Prioritizes models with high per-minute quota limits (gemini-3.5-flash-lite, gemini-3.1-flash-lite, gemini-flash-lite-latest).
    """
    if not api_key:
        return "Error: Gemini API Key is missing. Please set it in Settings."
    
    models_to_try = [
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-flash-lite-latest",
        "gemini-3.6-flash",
        "gemini-flash-latest",
        "gemini-2.0-flash-lite",
        "gemini-2.0-flash",
    ]

    # 1. Try google-genai native SDK first
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        for m in models_to_try:
            try:
                response = client.models.generate_content(
                    model=m,
                    contents=prompt,
                )
                if response and response.text:
                    return response.text
            except Exception:
                continue
    except Exception:
        pass

    # 2. Try google.generativeai SDK second
    try:
        import google.generativeai as genai_legacy
        genai_legacy.configure(api_key=api_key)
        for m in models_to_try:
            try:
                model = genai_legacy.GenerativeModel(m)
                response = model.generate_content(prompt)
                if response and response.text:
                    return response.text
            except Exception:
                continue
    except Exception:
        pass

    # 3. HTTP REST API endpoints fallback (Iterate across active Flash-Lite and Flash models)
    headers = {"Content-Type": "application/json"}
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    json_data = json.dumps(payload).encode("utf-8")

    last_error = ""

    for m in models_to_try:
        for version in ["v1beta", "v1"]:
            url = f"https://generativelanguage.googleapis.com/{version}/models/{m}:generateContent?key={api_key}"
            try:
                req = urllib.request.Request(url, data=json_data, headers=headers, method="POST")
                with urllib.request.urlopen(req, timeout=45) as response:
                    res_data = json.loads(response.read().decode("utf-8"))
                    candidates = res_data.get("candidates", [])
                    if candidates:
                        content = candidates[0].get("content", {})
                        parts = content.get("parts", [])
                        if parts and "text" in parts[0]:
                            return parts[0]["text"]
            except urllib.error.HTTPError as e:
                try:
                    error_body = e.read().decode("utf-8")
                    error_json = json.loads(error_body)
                    last_error = error_json.get("error", {}).get("message", str(e))
                except Exception:
                    last_error = f"HTTP {e.code}: {e.reason}"
            except Exception as e:
                last_error = str(e)

    return f"Error calling Gemini API: {last_error or 'No response from API'}"



def analyze_reply_text(reply_text: str, clues: str, api_key: str) -> str:
    """
    Analyzes bank/telecom email replies and summarizes them.
    Correlates details with case clues if provided.
    """
    prompt = f"""
You are an expert Cyber Crime Investigation Assistant. Analyze the following official response received from a bank or telecom operator in response to a police request.

CLUES OR INVESTIGATION CONTEXT GIVEN BY INVESTIGATING OFFICER:
{clues or 'No specific clues provided yet.'}

OFFICIAL RESPONSE TO ANALYZE:
---
{reply_text}
---

Please perform a thorough analysis and provide a clear, formatted report with:
1. **Executive Summary**: A concise 2-3 sentence overview of what the response states (e.g. Account frozen, call details shared, statements attached, request rejected, etc.)
2. **Key Entities Identified**: Extract names, account numbers, mobile numbers, transaction IDs, IMEI/IMSI numbers, IP addresses, dates, or emails mentioned.
3. **Investigation Action Status**: What was requested vs. what was actually executed/provided (e.g., Requested: Freeze account. Status: Account frozen with $X balance, or Statement provided).
4. **Dot-Connecting / Correlation**: Map any items in this reply to the Investigation Officer's clues. Are there matches? Are there discrepancies?
5. **Recommended Next Steps**: List actionable next steps for the investigating officer based on this reply (e.g., Send notice to A-party, request IP logs from gateway, track IMEI, verify coordinates).

Keep the report professional, structured, and easy for police officers to read.
"""
    return call_gemini(prompt, api_key)

def analyze_cdr_records(cdr_summary: Dict[str, Any], clues: str, api_key: str) -> str:
    """
    Correlates aggregated CDR statistics, sample logs, and nighttime calls
    with the investigating officer's clues to connect the dots.
    """
    # Create compact stats summary for the LLM prompt
    stats_summary = f"""
- Total call/event records parsed: {cdr_summary.get('total_records')}
- Date Range of Records: {cdr_summary.get('date_range')}
- Primary Target/Suspect Number Candidate: {cdr_summary.get('suspect_candidate')}

Top 10 Most Contacted Numbers (Number: Frequency):
{json.dumps(cdr_summary.get('top_contacts'), indent=2)}

Top 10 Interacting Pairs:
{json.dumps(cdr_summary.get('top_pairs'), indent=2)}

Nighttime Calls (10 PM to 6 AM) Count: {cdr_summary.get('night_calls_count')}

IMEI Swaps detected (Sim in multiple devices):
{json.dumps(cdr_summary.get('imei_swaps'), indent=2)}

Top Cell IDs / Tower Locations:
{json.dumps(cdr_summary.get('top_locations'), indent=2)}

Sample Call Records (first few records):
{json.dumps(cdr_summary.get('sample_records'), indent=2)}
"""

    prompt = f"""
You are a senior Cyber Crime Intelligence Analyst. You are assisting an Investigating Officer (IO) to analyze a dataset of Call Detail Records (CDR). 
Your goal is to perform a deep analysis of these records and connect them to the clues of the case.

INVESTIGATION CLUES / CONTEXT PROVIDED BY OFFICER:
{clues or 'No specific clues provided. Perform a general intelligence analysis of the CDR patterns.'}

CDR STATISTICS & AGGREGATE SUMMARY:
{stats_summary}

Please generate a comprehensive, highly professional Cyber Crime Intelligence Report. Your analysis should contain:
1. **Intelligence Summary**: A high-level overview of the target's call behaviour and timeline.
2. **Clue Correlation & Dot Connecting**: 
   - Check if any numbers in the CDR match the suspect numbers in the clues.
   - Correlate timestamps in the clues (e.g., date/time of crime) with the calls. Are there calls occurring exactly at or near the crime timeline? Who was the target talking to? Which tower location was active?
   - Identify geographical locations (Cell IDs) that correlate with the clues.
3. **Suspicious Behavioral Patterns**:
   - Analyze nighttime calling (10 PM - 6 AM). Are there frequent nighttime contacts?
   - Analyze IMEI swaps. If the SIM card was moved between multiple phones, list the devices and discuss the implications (e.g. burn phones, stolen devices).
   - Frequency peaks (is there a sudden surge in calls on a specific day?).
4. **Key Suspect Network**: Identify the top 3-5 most suspicious nodes (phone numbers) interacting with the target, detailing the frequency and duration.
5. **Actionable Leads**: Provide a concrete list of next steps for the police (e.g., "Issue notice under Section 91 CrPC/94 BNSS to Telecom Operator X to get subscriber details (CAF/SDR) of number Y", "Locate Cell Tower CGI Z", "Examine suspect contact W").

Make sure to highlight key findings clearly. Be logical, forensic, and direct.
"""
    return call_gemini(prompt, api_key)

def correlate_investigation_evidence(case: Dict[str, Any], api_key: str) -> str:
    """
    Correlates multiple streams of evidence (CDR logs, Bank statements, KYC records)
    under the same case, searching for shared entities and common indicators (Phase 12).
    """
    # Build case summary for context
    targets_summary = json.dumps(case.get("targets", []), indent=2)
    timeline_summary = json.dumps(case.get("timeline", []), indent=2)
    
    evidence_list = []
    for ev in case.get("evidence", []):
        evidence_list.append({
            "id": ev.get("id"),
            "filename": ev.get("filename"),
            "type": ev.get("type"),
            "summary": ev.get("summary"),
            "metadata": ev.get("metadata")
        })
    evidence_summary = json.dumps(evidence_list, indent=2)

    prompt = f"""
You are a senior Cyber Forensic Investigator. Your task is to perform an Investigation Correlation Analysis (Phase 12) on the evidence collected for Case ID: {case.get("case_id")}.

CASE INTAKE PARAMETERS:
- FIR Number: {case.get("fir_number")}
- Investigation Purpose: {case.get("investigation_purpose")}
- Suspect Details: {case.get("suspect_details")}
- Victim Details: {case.get("victim_details")}

INVESTIGATION TARGET IDENTIFIERS:
{targets_summary}

EVIDENCE UPLOADED / PARSED (REPLY MAILS, STATEMENTS, CDR STATISTICS):
{evidence_summary}

TIMELINE EVENTS:
{timeline_summary}

Please analyze this case and write a Correlation Intelligence Report detailing:
1. **Shared Indicators**: Identify any overlapping mobile numbers, bank accounts, UPI IDs, email addresses, IP addresses, or device IMEIs across the different evidence files and response mails.
2. **Transaction-Communication Mapping**: Look for correlations between bank transactions (withdrawals/deposits/transfers) and call records. (e.g., did a call occur within minutes of a bank transfer? Do they share location cell towers?).
3. **Timeline Alignment**: Validate if the suspects' locations (Tower Cell IDs) match the timing of the crime or transaction events.
4. **Common Beneficiary Chain**: List any repeated counterparties or routing chains identified.
5. **Correlation Network Graph Description**: Describe how these entities are linked in a relationship network to assist the investigator.

Keep your analysis strictly factual and reference specific evidence files. Mark any unverified correlations as "Requires Investigator Review."
"""
    return call_gemini(prompt, api_key)

def generate_case_investigation_summary(case: Dict[str, Any], api_key: str) -> str:
    """
    Generates the final Phase 14 Case Summary Report containing Executive Summary,
    POIs, AOIs, recommendations, and confidence level metrics.
    """
    targets_summary = json.dumps(case.get("targets", []), indent=2)
    timeline_summary = json.dumps(case.get("timeline", []), indent=2)
    
    evidence_list = []
    for ev in case.get("evidence", []):
        evidence_list.append({
            "id": ev.get("id"),
            "filename": ev.get("filename"),
            "type": ev.get("type"),
            "summary": ev.get("summary")
        })
    evidence_summary = json.dumps(evidence_list, indent=2)

    prompt = f"""
You are a Cyber Crime Analyst assisting an Investigating Officer. You must generate the official Case Investigation Summary (Phase 14) for Case ID: {case.get("case_id")}.

CASE DETAILS:
- FIR Number: {case.get("fir_number")}
- Police Station: {case.get("police_station")}
- Investigating Officer: {case.get("officer_name")} ({case.get("officer_designation")})
- Legal Authority: {case.get("legal_authority")}
- Suspect Profile: {case.get("suspect_details")}
- Victim Profile: {case.get("victim_details")}
- Purpose: {case.get("investigation_purpose")}

TARGETS SPECIFIED:
{targets_summary}

EVIDENCE ACCUMULATED:
{evidence_summary}

CHRONOLOGICAL TIMELINE:
{timeline_summary}

Based on this evidence, compile the Cyber Forensic Investigation Summary conforming strictly to the following sections:

1. **Executive Summary**: A concise high-level overview of the case, the fraud event, and the response actions.
2. **Key Findings**: Fact-based findings derived directly from the evidence (e.g. account was active, locations match, call spikes).
3. **Evidence Received**: Bullet list of all analyzed evidence records and what they proved.
4. **Pending Requests**: Outstanding replies or pending telecom/bank compliance letters.
5. **Suspicious Activities**: Red flags, nighttime actions, device swaps, or transaction velocity alerts.
6. **Persons of Interest (POIs)**: Identify and rank individuals/numbers of interest based on call frequencies, shared properties, or KYC matches.
7. **Accounts of Interest (AOIs)**: List bank accounts, wallets, or UPI IDs that received funds or are linked to the suspect.
8. **Actionable Recommendations**: Clear, specific next steps for the investigating officer (e.g., issue freeze notice for account X, issue Section 91 notice for subscriber sheet of phone Y).
9. **Confidence Level**: Specify a Confidence rating (Low, Medium, High) with a 2-3 sentence justification explaining the density of matching evidence.

CRITICAL CONSTRAINTS:
- Do not reach legal conclusions or determine guilt.
- Limit conclusions to observations supported by the available evidence.
- Clearly distinguish facts from AI-generated observations.
- Mark uncertain findings as "Requires Investigator Review."
- Do not fabricate any names, accounts, dates, or details.
"""
    return call_gemini(prompt, api_key)
