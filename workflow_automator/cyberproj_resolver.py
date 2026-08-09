import os
import sys
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

def resolve_cyberproj_dir() -> Optional[str]:
    """
    Dynamically finds the root directory containing the cyberproj / cyberproj-orig / cyberproj-rig backend package.
    """
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    
    candidate_paths = [
        os.path.join(parent_dir, "cyberproj", "cyberproj", "cyberproj-orig"),
        os.path.join(parent_dir, "cyberproj", "cyberproj", "cyberproj-rig"),
        os.path.join(parent_dir, "cyberproj", "cyberproj-orig"),
        os.path.join(parent_dir, "cyberproj", "cyberproj-rig"),
        os.path.join(parent_dir, "cyberproj", "cyberproj"),
        os.path.join(parent_dir, "cyberproj"),
        os.path.join(parent_dir, "cyberproj-orig"),
        os.path.join(parent_dir, "cyberproj-rig"),
    ]
    
    for path in candidate_paths:
        if os.path.exists(os.path.join(path, "backend")):
            if path not in sys.path:
                sys.path.insert(0, path)
            return path
            
        if os.path.exists(path):
            for root, dirs, _ in os.walk(path):
                if "backend" in dirs:
                    if root not in sys.path:
                        sys.path.insert(0, root)
                    return root
                    
    return None

def get_cyberproj_services() -> Dict[str, Any]:
    """
    Returns imported cyberproj backend modules and services cleanly.
    """
    cyberproj_path = resolve_cyberproj_dir()
    cm = None
    log_action = None
    correlate_investigation_evidence = None
    generate_case_investigation_summary = None
    parse_cdr_file = None
    parse_bank_statement = None
    mail_monitor = None
    
    if cyberproj_path:
        try:
            import backend.services.case_manager as cm
        except Exception as e:
            logger.debug(f"Could not import case_manager: {e}")
            
        try:
            from backend.services.audit_logger import log_action
        except Exception as e:
            logger.debug(f"Could not import audit_logger: {e}")
            
        try:
            from backend.services.gemini_service import (
                correlate_investigation_evidence,
                generate_case_investigation_summary
            )
        except Exception as e:
            logger.debug(f"Could not import gemini_service: {e}")

        try:
            from backend.services.cdr_parser import parse_cdr_file
        except Exception as e:
            logger.debug(f"Could not import cdr_parser: {e}")

        try:
            from backend.services.bank_parser import parse_bank_statement
        except Exception as e:
            logger.debug(f"Could not import bank_parser: {e}")

        try:
            import backend.services.mail_monitor as mail_monitor
        except Exception as e:
            logger.debug(f"Could not import mail_monitor: {e}")
            
    return {
        "cyberproj_path": cyberproj_path,
        "cm": cm,
        "log_action": log_action,
        "correlate_investigation_evidence": correlate_investigation_evidence,
        "generate_case_investigation_summary": generate_case_investigation_summary,
        "parse_cdr_file": parse_cdr_file,
        "parse_bank_statement": parse_bank_statement,
        "mail_monitor": mail_monitor
    }
