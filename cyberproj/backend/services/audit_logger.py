import os
import json
import datetime
from typing import Dict, Any, List

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data")
AUDIT_FILE = os.path.join(DATA_DIR, "audit_log.json")

# Ensure data directory exists
os.makedirs(DATA_DIR, exist_ok=True)

def log_action(officer_name: str, action: str, details: Dict[str, Any]):
    """
    Logs an action to the immutable audit trail.
    """
    entry = {
        "timestamp": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "officer": officer_name or "System",
        "action": action,
        "details": details
    }
    
    logs = []
    if os.path.exists(AUDIT_FILE):
        try:
            with open(AUDIT_FILE, "r") as f:
                logs = json.load(f)
                if not isinstance(logs, list):
                    logs = []
        except Exception as e:
            print(f"Error reading audit file: {e}")
            logs = []
            
    logs.append(entry)
    
    try:
        # Write back to audit file
        with open(AUDIT_FILE, "w") as f:
            json.dump(logs, f, indent=2)
    except Exception as e:
        print(f"Error writing to audit file: {e}")

def get_audit_trail() -> List[Dict[str, Any]]:
    """
    Returns the full audit trail.
    """
    if os.path.exists(AUDIT_FILE):
        try:
            with open(AUDIT_FILE, "r") as f:
                return json.load(f)
        except Exception as e:
            print(f"Error reading audit file: {e}")
    return []
