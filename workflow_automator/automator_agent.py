import os
import sys
import json
import logging
import datetime
from typing import Dict, Any, Optional, List

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

def safe_print(*args, **kwargs):
    try:
        print(*args, **kwargs)
    except UnicodeEncodeError:
        safe_args = []
        for a in args:
            if isinstance(a, str):
                safe_args.append(a.encode("ascii", errors="replace").decode("ascii"))
            else:
                safe_args.append(a)
        print(*safe_args, **kwargs)

CYBERPROJ_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "cyberproj", "cyberproj")
if CYBERPROJ_DIR not in sys.path:
    sys.path.insert(0, CYBERPROJ_DIR)

try:
    import backend.services.case_manager as cm
    from backend.services.audit_logger import log_action
    from backend.services.gemini_service import correlate_investigation_evidence, generate_case_investigation_summary
except ImportError:
    cm = None
    log_action = None
    correlate_investigation_evidence = None
    generate_case_investigation_summary = None

from .template_engine import TemplateEngine, EmailCategory
from .smtp_mailer import SMTPMailer
from .analytics_agent import AnalyticsAgent

logger = logging.getLogger(__name__)

def _load_env():
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except Exception:
        pass

_load_env()

class MasterWorkflowAutomatorAgent:
    """
    MASTER WORKFLOW AUTOMATOR AGENT
    
    Integrated execution engine for law enforcement case investigations:
    1. Ingests evaluated case data & targets from Evaluator Agent.
    2. Synchronizes persistently with cyberproj case manager (cases.json) & audit logger.
    3. Renders statutory legal directives via TemplateEngine across BNSS/CrPC categories.
    4. Dispatches transactional email notices WITH tracking tokens (`[CrimeOS-REF: case_num]`).
    5. Asynchronously ingests recipient replies & evidence attachments (CSV/PDF/Text).
    6. Uses AnalyticsAgent + cyberproj domain parsers (cdr_parser, bank_parser) for extraction.
    7. Automatically extracts secondary suspect entities and auto-adds new targets to the case.
    8. Executes Gemini AI evidence correlation & summary generation automatically.
    """
    def __init__(
        self,
        template_engine: Optional[TemplateEngine] = None,
        smtp_mailer: Optional[SMTPMailer] = None,
        analytics_agent: Optional[AnalyticsAgent] = None,
        api_key: Optional[str] = None
    ):
        self.template_engine = template_engine or TemplateEngine()
        self.smtp_mailer = smtp_mailer or SMTPMailer()
        self.analytics_agent = analytics_agent or AnalyticsAgent(api_key=api_key)
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY")
        
        self.pending_cases: Dict[str, Dict[str, Any]] = {}
        self.case_history: Dict[str, List[Dict[str, Any]]] = {}

    def ingest_evaluator_data(self, evaluator_payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        INGEST EVALUATOR AGENT OUTPUT & AUTOMATE WORKFLOW.
        Accepts structured case metadata, evaluated targets, and recommended directives from the Evaluator Agent.
        Registers the case in cyberproj case_manager and executes automated notice dispatch & processing.
        """
        safe_print("\n" + "╔" + "═"*78 + "╗")
        safe_print("║ 🤖 WORKFLOW AUTOMATOR | INGESTING EVALUATOR AGENT OUTPUT PAYLOAD           ║")
        safe_print("╚" + "═"*78 + "╝\n")

        case_meta = evaluator_payload.get("case_metadata", {})
        case_id = case_meta.get("case_id") or case_meta.get("fir_number") or f"CR-{int(datetime.datetime.now().timestamp())}"
        
        # Format case structure for cyberproj case_manager
        case_dict = {
            "case_id": case_id,
            "fir_number": case_meta.get("fir_number", case_id),
            "police_station": case_meta.get("police_station", "Cyber Crime Police Station"),
            "officer_name": case_meta.get("officer_name", "Investigating Officer"),
            "officer_designation": case_meta.get("officer_designation", "Police Inspector"),
            "official_email": case_meta.get("official_email", "officer@police.gov.in"),
            "investigation_purpose": case_meta.get("investigation_purpose", "Cybercrime Financial Investigation"),
            "legal_authority": case_meta.get("legal_authority", "Section 106 / 94 BNSS"),
            "date": case_meta.get("date", datetime.date.today().strftime("%Y-%m-%d")),
            "suspect_details": case_meta.get("suspect_details", ""),
            "victim_details": case_meta.get("victim_details", "")
        }

        # 1. Register or get existing case in cyberproj case manager
        if cm:
            existing = cm.get_case(case_id)
            if not existing:
                try:
                    cm.create_case(case_dict)
                    safe_print(f"✅ [Evaluator Ingestion] Case '{case_id}' created in persistent case_manager.")
                except Exception as e:
                    safe_print(f"⚠️ [Evaluator Ingestion] Case creation note: {e}")
            else:
                safe_print(f"ℹ️ [Evaluator Ingestion] Case '{case_id}' already exists in persistent storage.")

        # 2. Add evaluated targets from Evaluator Agent
        evaluated_targets = evaluator_payload.get("evaluated_targets", [])
        added_targets = []
        for tgt in evaluated_targets:
            target_data = {
                "type": tgt.get("type", "bank"),
                "identifier": tgt.get("identifier", "").strip(),
                "name": tgt.get("name", "Suspect Entity").strip(),
                "entity_name": tgt.get("entity_name", "Compliance Division").strip(),
                "details": tgt.get("details", "").strip()
            }
            if target_data["identifier"]:
                if cm:
                    try:
                        t_obj = cm.add_target(case_id, target_data)
                        added_targets.append(t_obj)
                        safe_print(f"   🎯 Added Target from Evaluator: {target_data['type'].upper()} - {target_data['identifier']} ({target_data['entity_name']})")
                    except Exception as e:
                        added_targets.append(target_data)
                        safe_print(f"   ⚠️ Target addition note: {e}")
                else:
                    added_targets.append(target_data)
                    safe_print(f"   🎯 Added Target from Evaluator: {target_data['type'].upper()} - {target_data['identifier']} ({target_data['entity_name']})")

        # 3. Log audit trail
        if log_action:
            log_action(case_dict["officer_name"], "Evaluator Agent Data Ingested", {
                "case_id": case_id,
                "targets_count": len(evaluated_targets)
            })

        # Store in local case state
        if case_id not in self.pending_cases:
            self.pending_cases[case_id] = {
                "case_id": case_id,
                "targets": added_targets,
                "case_metadata": case_meta
            }

        # 4. Trigger automated workflow execution on ingested case
        pipeline_res = self.run_automated_case_pipeline(case_id=case_id)
        
        return {
            "status": "success",
            "case_id": case_id,
            "targets_ingested": len(added_targets),
            "pipeline_result": pipeline_res
        }

    def dispatch_investigation_notice(
        self,
        case_number: str,
        investigation_objective: str,
        receiver_name: str,
        receiver_email: str,
        receiver_type: str,
        context_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Email Notice Dispatch with cyberproj case_manager persistence.
        """
        safe_print("\n" + "╔" + "═"*78 + "╗")
        safe_print(f"║ 🛡️ MASTER WORKFLOW AUTOMATOR | Case: {case_number:<27} ║")
        safe_print(f"║ Objective: {investigation_objective[:62]:<62} ║")
        safe_print("╚" + "═"*78 + "╝\n")

        context = context_data or {}
        context["case_number"] = case_number
        context["receiver_name"] = receiver_name
        context["current_date"] = datetime.date.today().strftime("%Y-%m-%d")

        # Nodal Receiver Email Auto-Resolution via TemplateEngine Directory
        if not receiver_email or "example.com" in receiver_email:
            nodal_contact = self.template_engine.get_receiver_contact(receiver_name) or self.template_engine.get_receiver_contact(receiver_type)
            if nodal_contact:
                resolved_email = nodal_contact.get("email")
                if resolved_email:
                    receiver_email = resolved_email
                    safe_print(f"🔹 [Nodal Receiver Directory Lookup] Auto-Resolved Nodal Email: '{receiver_email}' ({nodal_contact.get('entity_name')})")

        # Step 1: Select Template
        template_id = self._classify_and_select_template(investigation_objective, receiver_type, context)
        safe_print(f"🔹 [Step 1: Case Classification & Template Selection]")
        safe_print(f"   Selected Template ID: '{template_id}'")

        # Step 2: Render Template
        rendered_email = self.template_engine.render_email(template_id, context)
        
        # Deduplicate tracking token in subject if already present
        if f"[CrimeOS-REF: {case_number}]" in rendered_email["subject"]:
            tracking_subject = rendered_email["subject"]
        else:
            tracking_subject = f"{rendered_email['subject']} [CrimeOS-REF: {case_number}]"

        safe_print(f"🔹 [Step 2: Template Rendered]")
        safe_print(f"   Subject: {tracking_subject}")

        # Step 3: Dispatch Email via Mailer
        dispatch_result = self.smtp_mailer.send_email(
            to_email=receiver_email,
            to_name=receiver_name,
            subject=tracking_subject,
            body_text=rendered_email["body"],
            case_number=case_number
        )

        # Step 4: Register in cyberproj case_manager if available
        request_id = None
        if cm and cm.get_case(case_number):
            try:
                req_obj = cm.add_request(case_number, {
                    "type": template_id,
                    "target_identifier": context.get("target_identifier", receiver_name),
                    "entity_name": context.get("entity_name", receiver_name),
                    "legal_section": rendered_email.get("legal_statute_ref", "BNSS/CrPC"),
                    "subject": tracking_subject,
                    "body": rendered_email["body"]
                })
                request_id = req_obj.get("id")
                cm.update_request_status(case_number, request_id, "sent", {
                    "message_id": dispatch_result.get("message_id", ""),
                    "subject": tracking_subject,
                    "body": rendered_email["body"]
                })
            except Exception as e:
                safe_print(f"⚠️ Case manager request recording note: {e}")

        # Step 5: Update pending cases state
        case_state = {
            "case_number": case_number,
            "objective": investigation_objective,
            "status": "AWAITING_PROVIDER_REPLY",
            "receiver": {"name": receiver_name, "email": receiver_email, "type": receiver_type},
            "template_id": template_id,
            "request_id": request_id,
            "dispatch_result": dispatch_result,
            "dispatched_at": datetime.datetime.now().isoformat()
        }
        self.pending_cases[case_number] = case_state

        if case_number not in self.case_history:
            self.case_history[case_number] = []
        self.case_history[case_number].append(case_state)

        safe_print(f"🔹 [Step 4: State & Timeline Persistence]")
        safe_print(f"   ► Status Registered: 'AWAITING_PROVIDER_REPLY'")
        safe_print(f"   ► Tracking Token: [CrimeOS-REF: {case_number}]\n")

        return case_state

    def handle_async_incoming_reply(
        self,
        case_number: str,
        sender_email: str,
        subject: str,
        body_text: str,
        attachments: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        ASYNC CALLBACK HANDLER: Processing incoming replies & attachments using cyberproj parsers.
        """
        safe_print("\n" + "⚡"*40)
        safe_print(f"⚡ [MASTER AUTOMATOR AGENT] ASYNC REPLY RECEIVED FOR CASE: {case_number}")
        safe_print(f"   Sender: {sender_email}")
        safe_print(f"   Attachments Received: {len(attachments or [])}")
        safe_print("⚡"*40)

        case_state = self.pending_cases.get(case_number, {
            "case_number": case_number,
            "receiver": {"name": sender_email, "email": sender_email, "type": "external_provider"}
        })

        file_input = body_text
        response_format = "text"

        if attachments:
            att = attachments[0]
            file_input = att.get("file_path") or att.get("content", body_text)
            response_format = att.get("format", "csv" if att.get("filename", "").endswith(".csv") else "text")

        # Step A: Resolve Provider Name dynamically from sender email / directory lookup / domain
        provider_name = sender_email
        if "@" in sender_email:
            domain_part = sender_email.split("@")[1].lower()
            if "hdfc" in domain_part: provider_name = "HDFC Bank"
            elif "sbi" in domain_part: provider_name = "State Bank of India"
            elif "icici" in domain_part: provider_name = "ICICI Bank"
            elif "axis" in domain_part: provider_name = "Axis Bank"
            elif "airtel" in domain_part: provider_name = "Airtel Telecommunications"
            elif "jio" in domain_part: provider_name = "Reliance Jio"
            elif "vodafone" in domain_part or "idea" in domain_part or "vi" in domain_part: provider_name = "Vodafone Idea (Vi)"
            elif "google" in domain_part: provider_name = "Google LLC"
            elif "meta" in domain_part or "facebook" in domain_part: provider_name = "Meta Platforms"
            elif "whatsapp" in domain_part: provider_name = "WhatsApp Inc."
            elif "mca" in domain_part or "roc" in domain_part: provider_name = "Registrar of Companies (ROC)"
            elif "fsl" in domain_part or "police" in domain_part: provider_name = "State Forensic Science Lab / Police Unit"
            else:
                contact_match = self.template_engine.get_receiver_contact(domain_part.split(".")[0])
                if contact_match:
                    provider_name = contact_match.get("entity_name", sender_email)
                else:
                    provider_name = domain_part.split(".")[0].title()

        analytics_output = self.analytics_agent.analyze_response(
            provider_name=provider_name,
            response_type=response_format,
            file_path_or_content=file_input,
            case_number=case_number
        )

        # Step B: Register evidence in cyberproj case_manager if available
        if cm and cm.get_case(case_number):
            try:
                for att in (attachments or []):
                    fname = att.get("filename", f"reply_{case_number}.txt")
                    fpath = att.get("file_path", "")
                    cm.add_evidence(
                        case_id=case_number,
                        filename=fname,
                        file_type="cdr" if "cdr" in fname.lower() else ("bank_statement" if "csv" in response_format or "bank" in fname.lower() else "reply"),
                        file_path=fpath,
                        summary=f"Ingested by Automator Agent: {analytics_output.get('recommended_next_action', '')}",
                        metadata=analytics_output.get("extracted_entities", {})
                    )
            except Exception as e:
                safe_print(f"⚠️ Evidence registration note: {e}")

        # Step C: Extract secondary suspect entities & Auto-Add New Targets to case
        extracted_entities = analytics_output.get("extracted_entities", {})
        new_targets_added = []
        if cm and cm.get_case(case_number):
            for acc in extracted_entities.get("account_numbers", []):
                try:
                    t_obj = cm.add_target(case_number, {
                        "type": "bank",
                        "identifier": str(acc),
                        "name": f"Discovered Mule Account ({acc})",
                        "entity_name": "Inter-bank Transfer Receiver",
                        "details": f"Auto-discovered by Automator Agent from {provider_name} response."
                    })
                    new_targets_added.append(t_obj)
                    safe_print(f"   🎯 [AUTO-TARGET ADDED] Discovered secondary bank account: {acc}")
                except Exception:
                    pass

            for phone in extracted_entities.get("phone_numbers", []):
                try:
                    t_obj = cm.add_target(case_number, {
                        "type": "telecom",
                        "identifier": str(phone),
                        "name": f"Discovered Suspect Phone ({phone})",
                        "entity_name": "Telecom Operator",
                        "details": f"Auto-discovered by Automator Agent from {provider_name} response."
                    })
                    new_targets_added.append(t_obj)
                    safe_print(f"   🎯 [AUTO-TARGET ADDED] Discovered secondary phone number: {phone}")
                except Exception:
                    pass

        # Standalone target tracking fallback (guarantees auto_added_targets are tracked)
        if not new_targets_added:
            for acc in extracted_entities.get("account_numbers", []):
                t_obj = {
                    "type": "bank",
                    "identifier": str(acc),
                    "name": f"Discovered Mule Account ({acc})",
                    "entity_name": "Inter-bank Transfer Receiver",
                    "details": f"Auto-discovered by Automator Agent from {provider_name} response."
                }
                new_targets_added.append(t_obj)
                safe_print(f"   🎯 [AUTO-TARGET ADDED] Discovered secondary bank account: {acc}")
            for phone in extracted_entities.get("phone_numbers", []):
                t_obj = {
                    "type": "telecom",
                    "identifier": str(phone),
                    "name": f"Discovered Suspect Phone ({phone})",
                    "entity_name": "Telecom Operator",
                    "details": f"Auto-discovered by Automator Agent from {provider_name} response."
                }
                new_targets_added.append(t_obj)
                safe_print(f"   🎯 [AUTO-TARGET ADDED] Discovered secondary phone number: {phone}")

        # Step D: Determine next workflow step
        next_action = self._determine_next_workflow_step(analytics_output, case_number)
        case_state["status"] = "RESPONSE_RECEIVED_AND_ANALYZED"
        case_state["analytics_result"] = analytics_output
        case_state["next_investigation_directive"] = next_action
        case_state["auto_added_targets"] = new_targets_added
        case_state["reply_received_at"] = datetime.datetime.now().isoformat()

        # Step E: Trigger Gemini AI Correlation & Case Summary if API Key present
        if self.api_key and cm and cm.get_case(case_number):
            try:
                case_obj = cm.get_case(case_number)
                if correlate_investigation_evidence:
                    corr_report = correlate_investigation_evidence(case_obj, self.api_key)
                    case_state["ai_correlation_report"] = corr_report
                    safe_print(f"   🧠 [AI CORRELATION] Generated evidence correlation report for case {case_number}.")
                if generate_case_investigation_summary:
                    case_sum = generate_case_investigation_summary(case_obj, self.api_key)
                    case_state["ai_case_summary"] = case_sum
                    safe_print(f"   🧠 [AI CASE SUMMARY] Generated investigation summary report.")
            except Exception as e:
                safe_print(f"⚠️ Gemini AI Service call note: {e}")

        safe_print(f"🔹 [Master Workflow Decision Engine Updated]")
        safe_print(f"   ► Strategy Summary: {next_action.get('strategy_summary')}")
        safe_print(f"   ► Auto-Discovered Targets Added: {len(new_targets_added)}\n")

        self.pending_cases[case_number] = case_state
        if case_number not in self.case_history:
            self.case_history[case_number] = []
        self.case_history[case_number].append(case_state)

        return case_state

    def run_automated_case_pipeline(
        self,
        case_id: str,
        simulated_responses: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """
        END-TO-END AUTOMATED CASE PIPELINE EXECUTION.
        Iterates over all targets in the case, drafts statutory notices, dispatches emails,
        monitors/ingests responses, auto-extracts new targets, and updates case manager.
        """
        safe_print("\n" + "═"*85)
        safe_print(f" 🚀 AUTOMATED CASE INVESTIGATION PIPELINE RUNNING FOR CASE: {case_id}")
        safe_print("═"*85)

        case_obj = cm.get_case(case_id) if cm else None
        if not case_obj:
            case_obj = self.pending_cases.get(case_id, {
                "case_id": case_id,
                "targets": [{"type": "bank", "identifier": "501004928172", "entity_name": "HDFC Bank", "name": "Target Account"}]
            })

        targets = case_obj.get("targets", [])
        dispatched_notices = []

        # 1. Automate Notice Dispatch for all Targets
        for tgt in targets:
            tgt_type = tgt.get("type", "bank")
            tgt_ident = tgt.get("identifier", "")
            tgt_entity = tgt.get("entity_name", "Nodal Officer")
            tgt_name = tgt.get("name", "Compliance Department")

            objective = f"Statutory directive for {tgt_type.upper()} target {tgt_ident} ({tgt_name})"
            if tgt_type == "bank":
                objective = f"Urgent Financial Hold and Account Freeze Directive for Bank Account {tgt_ident}"
            elif tgt_type == "telecom":
                objective = f"Requisition for Call Detail Records (CDR) and tower details for mobile {tgt_ident}"

            rec_email = os.environ.get("SENDER_EMAIL", "officer.cyber@police.gov.in")
            
            notice_state = self.dispatch_investigation_notice(
                case_number=case_id,
                investigation_objective=objective,
                receiver_name=tgt_entity,
                receiver_email=rec_email,
                receiver_type=tgt_type,
                context_data={
                    "target_identifier": tgt_ident,
                    "account_number": tgt_ident,
                    "account_holder": tgt_name,
                    "entity_name": tgt_entity,
                    "investigating_officer": case_obj.get("officer_name", "Investigating Officer"),
                    "police_station": case_obj.get("police_station", "Cyber Crime Police Station")
                }
            )
            dispatched_notices.append(notice_state)

        # 2. Process Simulated or Ingested Responses if provided
        processed_replies = []
        if simulated_responses:
            for resp in simulated_responses:
                reply_state = self.handle_async_incoming_reply(
                    case_number=case_id,
                    sender_email=resp.get("sender_email", "compliance@institution.com"),
                    subject=resp.get("subject", f"Re: Legal Order [CrimeOS-REF: {case_id}]"),
                    body_text=resp.get("body_text", ""),
                    attachments=resp.get("attachments")
                )
                processed_replies.append(reply_state)

        return {
            "case_id": case_id,
            "notices_dispatched_count": len(dispatched_notices),
            "replies_processed_count": len(processed_replies),
            "latest_case_state": self.pending_cases.get(case_id, {})
        }

    def _classify_and_select_template(self, objective: str, receiver_type: str, context: Dict[str, Any]) -> str:
        obj_lower = objective.lower()
        rec_lower = receiver_type.lower()

        if any(x in rec_lower for x in ["bank", "payment", "upi", "exchange", "crypto", "financial"]):
            if "freeze" in obj_lower or "hold" in obj_lower or "stolen" in obj_lower:
                return "financial_freeze_order"
            return "demand_produce_documents"

        if any(x in rec_lower for x in ["tech", "google", "meta", "whatsapp", "apple", "telecom", "isp", "intermediary"]):
            if "preserve" in obj_lower or "freeze log" in obj_lower or "180" in obj_lower:
                return "data_preservation_request"
            return "legal_order_user_data"

        if any(x in rec_lower for x in ["witness", "victim", "complainant"]):
            if "appear" in obj_lower or "summons" in obj_lower or "statement" in obj_lower:
                return "notice_to_appear_witness"
            elif "clarify" in obj_lower or "question" in obj_lower or "timeline" in obj_lower:
                return "request_clarification"
            elif "evidence" in obj_lower or "photo" in obj_lower or "video" in obj_lower or "upload" in obj_lower:
                return "evidence_submission_directive"
            elif "update" in obj_lower or "status" in obj_lower or "progress" in obj_lower:
                return "case_status_update"

        if any(x in rec_lower for x in ["suspect", "accused", "perpetrator"]):
            if "appear" in obj_lower or "join" in obj_lower or "35" in obj_lower or "41a" in obj_lower:
                return "notice_of_appearance_suspect"
            elif "document" in obj_lower or "device" in obj_lower or "produce" in obj_lower:
                return "demand_produce_documents"
            elif "warning" in obj_lower or "tamper" in obj_lower or "lookout" in obj_lower:
                return "lookout_warning_notice"

        if any(x in rec_lower for x in ["agency", "prosecutor", "court", "interpol", "police"]):
            if "transfer" in obj_lower or "jurisdiction" in obj_lower:
                return "jurisdictional_transfer_note"
            elif "mlat" in obj_lower or "international" in obj_lower or "interpol" in obj_lower:
                return "mlat_request"
            elif "court" in obj_lower or "charge sheet" in obj_lower or "prosecutor" in obj_lower:
                return "prosecutional_court_update"

        if "freeze" in obj_lower: return "financial_freeze_order"
        if "preserv" in obj_lower: return "data_preservation_request"
        if "user data" in obj_lower or "ip" in obj_lower: return "legal_order_user_data"
        if "summons" in obj_lower: return "notice_to_appear_witness"
        if "notice of appearance" in obj_lower: return "notice_of_appearance_suspect"

        return "custom_extended_notice"

    def _determine_next_workflow_step(self, analytics_data: Dict[str, Any], case_number: str) -> Dict[str, Any]:
        risk = analytics_data.get("risk_score", 5)
        entities = analytics_data.get("extracted_entities", {})

        accounts = entities.get("account_numbers", [])
        ips = entities.get("ip_addresses", [])

        if accounts and risk >= 7:
            return {
                "strategy_summary": f"High risk ({risk}/10): Suspect bank accounts detected in response.",
                "recommended_template_trigger": "Issue Financial Freeze Order (financial_freeze_order) under Sec 106 BNSS to identified Banks.",
                "target_entities": accounts
            }
        elif ips and risk >= 6:
            return {
                "strategy_summary": f"Moderate-High risk ({risk}/10): Suspect IP logs extracted.",
                "recommended_template_trigger": "Issue Statutory User Data & Preservation Order (legal_order_user_data) to relevant ISP / Tech Platform.",
                "target_entities": ips
            }
        else:
            return {
                "strategy_summary": "Standard response processed. No immediate emergency freeze required.",
                "recommended_template_trigger": "Issue Follow-up Statement Request or Case Status Update to Victim.",
                "target_entities": []
            }
