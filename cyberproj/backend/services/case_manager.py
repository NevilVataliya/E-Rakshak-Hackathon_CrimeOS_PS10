import os
import json
import uuid
import datetime
from typing import Dict, Any, List, Optional

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data")
CASES_FILE = os.path.join(DATA_DIR, "cases.json")

# Ensure data directory exists
os.makedirs(DATA_DIR, exist_ok=True)

def load_cases_db() -> Dict[str, Any]:
    if os.path.exists(CASES_FILE):
        try:
            with open(CASES_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading cases db: {e}")
    return {}

def save_cases_db(db: Dict[str, Any]):
    try:
        with open(CASES_FILE, "w") as f:
            json.dump(db, f, indent=2)
    except Exception as e:
        print(f"Error saving cases db: {e}")

def create_case(case_data: Dict[str, Any]) -> Dict[str, Any]:
    # Phase 1: Validate Mandatory Fields
    mandatory_fields = [
        "case_id", "fir_number", "police_station", 
        "officer_name", "officer_designation", "official_email", 
        "investigation_purpose", "legal_authority"
    ]
    
    missing = [field for field in mandatory_fields if not case_data.get(field, "").strip()]
    if missing:
        raise ValueError(f"Missing mandatory fields: {', '.join(missing)}")
        
    db = load_cases_db()
    case_id = case_data["case_id"].strip()
    
    if case_id in db:
        raise ValueError(f"Case ID '{case_id}' already exists.")
        
    case = {
        "case_id": case_id,
        "fir_number": case_data["fir_number"].strip(),
        "police_station": case_data["police_station"].strip(),
        "officer_name": case_data["officer_name"].strip(),
        "officer_designation": case_data["officer_designation"].strip(),
        "official_email": case_data["official_email"].strip(),
        "investigation_purpose": case_data["investigation_purpose"].strip(),
        "legal_authority": case_data["legal_authority"].strip(),
        "date": case_data.get("date") or datetime.datetime.now().strftime("%Y-%m-%d"),
        "suspect_details": case_data.get("suspect_details", "").strip(),
        "victim_details": case_data.get("victim_details", "").strip(),
        "targets": [],
        "requests": [],
        "evidence": [],
        "timeline": []
    }
    
    # Initialize timeline
    case["timeline"].append({
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "event_type": "Case Intake Created",
        "description": f"Case initiated by {case['officer_name']} ({case['officer_designation']}) under authority {case['legal_authority']}.",
        "category": "case_created"
    })
    
    db[case_id] = case
    save_cases_db(db)
    return case

def get_case(case_id: str) -> Optional[Dict[str, Any]]:
    db = load_cases_db()
    return db.get(case_id)

def get_all_cases() -> List[Dict[str, Any]]:
    db = load_cases_db()
    return list(db.values())

def add_target(case_id: str, target: Dict[str, Any]) -> Dict[str, Any]:
    db = load_cases_db()
    if case_id not in db:
        raise ValueError(f"Case '{case_id}' not found.")
        
    target_id = str(uuid.uuid4())[:8]
    new_target = {
        "id": target_id,
        "type": target.get("type", "bank"), # bank, telecom, device, ip, other
        "identifier": target.get("identifier", "").strip(),
        "name": target.get("name", "").strip(),
        "entity_name": target.get("entity_name", "").strip(), # Bank/Operator name
        "details": target.get("details", "").strip()
    }
    
    if not new_target["identifier"]:
        raise ValueError("Identifier is mandatory for target.")
        
    db[case_id]["targets"].append(new_target)
    
    # Add timeline event
    db[case_id]["timeline"].append({
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "event_type": "Target Added",
        "description": f"New target target added: {new_target['type'].upper()} - {new_target['identifier']} ({new_target['entity_name']}).",
        "category": "target_added"
    })
    
    save_cases_db(db)
    return new_target

def add_request(case_id: str, request_data: Dict[str, Any]) -> Dict[str, Any]:
    db = load_cases_db()
    if case_id not in db:
        raise ValueError(f"Case '{case_id}' not found.")
        
    request_id = str(uuid.uuid4())[:8]
    new_request = {
        "id": request_id,
        "type": request_data.get("type", "freeze"), # freeze, statement, cdr
        "target_identifier": request_data.get("target_identifier", "").strip(),
        "entity_name": request_data.get("entity_name", "").strip(),
        "legal_section": request_data.get("legal_section", "").strip(),
        "status": "draft", # draft, approved, sent
        "subject": request_data.get("subject", "").strip(),
        "body": request_data.get("body", "").strip(),
        "sent_timestamp": "",
        "message_id": ""
    }
    
    db[case_id]["requests"].append(new_request)
    save_cases_db(db)
    return new_request

def update_request_status(case_id: str, request_id: str, status: str, details: Dict[str, Any]) -> Dict[str, Any]:
    db = load_cases_db()
    if case_id not in db:
        raise ValueError(f"Case '{case_id}' not found.")
        
    found = False
    updated_req = {}
    for req in db[case_id]["requests"]:
        if req["id"] == request_id:
            req["status"] = status
            if status == "sent":
                req["sent_timestamp"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                req["message_id"] = details.get("message_id", "")
            if details.get("subject"):
                req["subject"] = details["subject"]
            if details.get("body"):
                req["body"] = details["body"]
            updated_req = req
            found = True
            break
            
    if not found:
        raise ValueError(f"Request '{request_id}' not found in case.")
        
    # Add timeline event
    if status == "sent":
        db[case_id]["timeline"].append({
            "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "event_type": "Notice Sent via SMTP",
            "description": f"Notice {updated_req['type'].upper()} dispatched to {updated_req['entity_name']} nodal compliance cell. MsgID: {updated_req['message_id']}.",
            "category": "request_sent"
        })
        
    save_cases_db(db)
    return updated_req

def add_evidence(case_id: str, filename: str, file_type: str, file_path: str, summary: str = "", metadata: Dict[str, Any] = None) -> Dict[str, Any]:
    db = load_cases_db()
    if case_id not in db:
        raise ValueError(f"Case '{case_id}' not found.")
        
    evidence_id = str(uuid.uuid4())[:8]
    evidence = {
        "id": evidence_id,
        "filename": filename,
        "type": file_type, # cdr, bank_statement, kyc, reply
        "file_path": file_path,
        "uploaded_at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "summary": summary,
        "metadata": metadata or {}
    }
    
    db[case_id]["evidence"].append(evidence)
    
    # Add to timeline
    db[case_id]["timeline"].append({
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "event_type": f"Evidence Added ({file_type.upper()})",
        "description": f"File '{filename}' classification: {file_type.upper()} processed successfully.",
        "category": "evidence_received"
    })
    
    save_cases_db(db)
    return evidence

def add_timeline_event(case_id: str, event_type: str, description: str, category: str) -> Dict[str, Any]:
    db = load_cases_db()
    if case_id not in db:
        raise ValueError(f"Case '{case_id}' not found.")
        
    event = {
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "event_type": event_type,
        "description": description,
        "category": category
    }
    db[case_id]["timeline"].append(event)
    save_cases_db(db)
    return event
