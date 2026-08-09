import os
import json
import re
from enum import Enum
from typing import Dict, Any, Optional, List

class EmailCategory(str, Enum):
    WITNESS_VICTIM = "witness_victim"
    SUSPECT_ACCUSED = "suspect_accused"
    THIRD_PARTY_INTERMEDIARY = "third_party_intermediary"
    OTHER_AGENCY_LEGAL = "other_agency_legal"
    CUSTOM_EXTENDED = "custom_extended"

class EmailTemplate:
    def __init__(
        self,
        template_id: str,
        category: EmailCategory,
        title: str,
        subject_template: str,
        body_template: str,
        required_vars: List[str],
        legal_statute_ref: Optional[str] = None,
        domain: Optional[str] = None
    ):
        self.template_id = template_id
        self.category = category
        self.title = title
        self.subject_template = subject_template
        self.body_template = body_template
        self.required_vars = required_vars
        self.legal_statute_ref = legal_statute_ref
        self.domain = domain

    def render(self, context: Dict[str, Any]) -> Dict[str, str]:
        """
        Renders the subject and body template using variables provided in context.
        Provides safe defaults for missing placeholders.
        """
        rendered_subject = self._replace_placeholders(self.subject_template, context)
        rendered_body = self._replace_placeholders(self.body_template, context)
        return {
            "template_id": self.template_id,
            "category": self.category.value,
            "title": self.title,
            "subject": rendered_subject,
            "body": rendered_body,
            "legal_statute_ref": self.legal_statute_ref or ""
        }

    def _replace_placeholders(self, text: str, context: Dict[str, Any]) -> str:
        def replace(match):
            key = match.group(1).strip()
            val = context.get(key)
            if val is not None:
                return str(val)
            # Default fallbacks for common fields
            defaults = {
                "case_number": "[CR-XXXX/2026]",
                "receiver_name": "Sir/Madam",
                "investigating_officer": "Investigating Officer, Cyber Crime Division",
                "police_station": "Central Cyber Police Station",
                "legal_section": "Section 179 BNSS / Section 160 CrPC",
                "date_time": "Immediate / Scheduled Date",
                "place_or_link": "Police Station / Virtual VC Link",
                "secure_link": "https://crimeos.gov.in/evidence-upload",
                "deadline": "48 Hours from receipt",
                "account_number": "N/A",
                "target_identifier": "N/A",
                "agency_name": "Relevant Department / Agency",
                "details": "Details attached as per record."
            }
            return defaults.get(key, f"[{key.upper()}]")

        return re.sub(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}", replace, text)


class TemplateEngine:
    """
    Central repository and rendering engine for official law enforcement email templates across 5 Crime Domains.
    Loads templates and Nodal Receiver directory dynamically from notice_directory.json.
    """
    def __init__(self, json_path: Optional[str] = None):
        self._templates: Dict[str, EmailTemplate] = {}
        self.crime_domains: Dict[str, Any] = {}
        self.receiver_directory: Dict[str, Any] = {}
        
        self._register_default_templates()
        
        # Determine path to notice_directory.json
        if not json_path:
            json_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "notice_directory.json")
        
        if os.path.exists(json_path):
            self.load_json_directory(json_path)

    def load_json_directory(self, json_path: str):
        """
        Loads dynamic templates and Nodal Officer receiver email directory from JSON.
        """
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            
            self.crime_domains = data.get("crime_domains", {})
            self.receiver_directory = data.get("receiver_directory", {})
            
            raw_templates = data.get("templates", [])
            for tmpl in raw_templates:
                category_enum = EmailCategory.CUSTOM_EXTENDED
                try:
                    category_enum = EmailCategory(tmpl.get("category", "custom_extended"))
                except ValueError:
                    pass

                template_obj = EmailTemplate(
                    template_id=tmpl["template_id"],
                    category=category_enum,
                    title=tmpl.get("title", tmpl["template_id"]),
                    subject_template=tmpl.get("subject_template", ""),
                    body_template=tmpl.get("body_template", ""),
                    required_vars=tmpl.get("required_vars", []),
                    legal_statute_ref=tmpl.get("legal_statute_ref", ""),
                    domain=tmpl.get("domain", "")
                )
                self.register_template(template_obj)
        except Exception as e:
            print(f"⚠️ [TemplateEngine] Failed to load JSON directory '{json_path}': {e}")

    def register_authority(self, key: str, entity_name: str, email: str, type_str: str = "bank", department: str = "", description: str = ""):
        """
        Dynamically registers or updates a Nodal Authority in the template engine directory.
        """
        clean_key = key.lower().strip().replace(" ", "_")
        self.receiver_directory[clean_key] = {
            "key": clean_key,
            "entity_name": entity_name,
            "email": email,
            "type": type_str,
            "department": department or "Compliance Division",
            "description": description
        }
        print(f"✅ [TemplateEngine] Dynamic Authority Registered: '{clean_key}' -> {email} ({entity_name})")

    def load_authorities_from_db(self, db_url: Optional[str] = None):
        """
        Loads active Nodal Authorities dynamically from PostgreSQL database table.
        """
        url = db_url or os.environ.get("DATABASE_URL")
        if not url:
            return
        try:
            import psycopg2
            import psycopg2.extras
            conn = psycopg2.connect(url)
            cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            cur.execute("SELECT * FROM authorities WHERE is_active = true")
            rows = cur.fetchall()
            cur.close()
            conn.close()

            for r in rows:
                self.register_authority(
                    key=r["key"],
                    entity_name=r["entity_name"],
                    email=r["email"],
                    type_str=r.get("type", "bank"),
                    department=r.get("department", ""),
                    description=r.get("description", "")
                )
            print(f"✅ [TemplateEngine] Successfully loaded {len(rows)} dynamic Nodal Authorities from PostgreSQL.")
        except Exception as e:
            print(f"ℹ️ [TemplateEngine] DB authorities load note: {e}")

    def get_receiver_contact(self, entity_key_or_name: str) -> Optional[Dict[str, str]]:
        """
        Looks up designated Nodal Officer email address from the receiver directory.
        Supports exact key match or fuzzy keyword matching.
        """
        if not entity_key_or_name:
            return None
        
        key_lower = entity_key_or_name.lower().strip()
        
        # 1. Direct key match
        if key_lower in self.receiver_directory:
            return self.receiver_directory[key_lower]
        
        # 2. Fuzzy match against entity name or key
        for key, info in self.receiver_directory.items():
            ent_name = info.get("entity_name", "").lower()
            if key_lower in key or key in key_lower or key_lower in ent_name or ent_name in key_lower:
                return info
        
        return None

    def select_template_for_target(
        self,
        domain: Optional[str] = None,
        directive_action: Optional[str] = None,
        target_type: Optional[str] = None
    ) -> Optional[EmailTemplate]:
        """
        Dynamically selects the best matching template based on crime domain, directive action, or target type.
        """
        directive_lower = (directive_action or "").lower()
        target_lower = (target_type or "").lower()
        domain_lower = (domain or "").lower()

        # Alias map for quick resolution
        if "freeze" in directive_lower or "bank" in target_lower:
            tmpl = self.get_template("financial_freeze_order")
            if tmpl: return tmpl

        if "cdr" in directive_lower or "tower" in directive_lower or "telecom" in target_lower:
            tmpl = self.get_template("telecom_cdr_requisition")
            if tmpl: return tmpl

        if "ip" in directive_lower or "cyber" in target_lower or "log" in directive_lower:
            tmpl = self.get_template("cyber_ip_log_requisition")
            if tmpl: return tmpl

        if "cctv" in directive_lower or "physical" in target_lower:
            tmpl = self.get_template("physical_cctv_preservation")
            if tmpl: return tmpl

        if "payroll" in directive_lower or "corporate" in target_lower or "audit" in directive_lower:
            tmpl = self.get_template("corporate_audit_requisition")
            if tmpl: return tmpl

        # Fallback to domain match if specified
        if domain_lower:
            for tmpl in self._templates.values():
                if tmpl.domain and tmpl.domain.lower() == domain_lower:
                    return tmpl

        return self.get_template("custom_extended_notice")

    def register_template(self, template: EmailTemplate):
        self._templates[template.template_id] = template

    def create_custom_template(
        self,
        template_id: str,
        title: str,
        category_str: str,
        subject_template: str,
        body_template: str,
        required_vars: Optional[List[str]] = None,
        legal_statute_ref: Optional[str] = None,
        domain: Optional[str] = None
    ) -> EmailTemplate:
        """
        Dynamically creates and registers a new custom statutory notice template.
        """
        cat_enum = EmailCategory.CUSTOM_EXTENDED
        try:
            cat_enum = EmailCategory(category_str)
        except ValueError:
            pass

        tmpl = EmailTemplate(
            template_id=template_id,
            category=cat_enum,
            title=title,
            subject_template=subject_template,
            body_template=body_template,
            required_vars=required_vars or ["case_number", "receiver_name", "details"],
            legal_statute_ref=legal_statute_ref or "Bharatiya Nagarik Suraksha Sanhita (BNSS)",
            domain=domain or "custom"
        )
        self.register_template(tmpl)
        print(f"[+] [TemplateEngine] Registered Custom Notice Template: '{template_id}' ('{title}')")
        return tmpl


    def get_template(self, template_id: str) -> Optional[EmailTemplate]:
        alias_map = {
            "freeze": "financial_freeze_order",
            "statement": "demand_produce_documents",
            "cdr": "telecom_cdr_requisition",
            "ip_logs": "cyber_ip_log_requisition",
            "kyc": "demand_produce_documents"
        }
        actual_id = alias_map.get(template_id, template_id)
        return self._templates.get(actual_id)

    def list_templates_by_category(self, category: EmailCategory) -> List[EmailTemplate]:
        return [t for t in self._templates.values() if t.category == category]

    def list_domains(self) -> Dict[str, Any]:
        return self.crime_domains

    def render_email(self, template_id: str, context: Dict[str, Any]) -> Dict[str, str]:
        template = self.get_template(template_id)
        if not template:
            # Fallback to generic template
            template = self.get_template("custom_extended_notice")
        return template.render(context)

    def _register_default_templates(self):
        # ======================================================================
        # CATEGORY 1: WITNESSES OR VICTIMS
        # ======================================================================
        self.register_template(EmailTemplate(
            template_id="notice_to_appear_witness",
            category=EmailCategory.WITNESS_VICTIM,
            title="Notice to Appear / Summons for Statement",
            legal_statute_ref="Section 179 BNSS / Section 160 CrPC / Witness Summons",
            subject_template="OFFICIAL NOTICE: Summons for Examination in FIR No. {{case_number}}",
            body_template="""Dear {{receiver_name}},

OFFICIAL NOTICE UNDER {{legal_section}}

RE: Investigation in Case / FIR No. {{case_number}}
Offence: {{offence_type}}

You are hereby required to appear before the undersigned Investigating Officer at {{police_station}} on {{date_time}} (or join via virtual link: {{place_or_link}}) to record your official statement regarding the subject investigation.

Please bring a valid photo identification document and any relevant files or documentation associated with this matter.

Investigating Officer: {{investigating_officer}}
Police Station: {{police_station}}
Contact: {{officer_contact}}

Notice Issued Date: {{current_date}}
Note: Failure to comply without valid justification may attract statutory legal proceedings.""",
            required_vars=["case_number", "receiver_name", "date_time"]
        ))

        self.register_template(EmailTemplate(
            template_id="request_clarification",
            category=EmailCategory.WITNESS_VICTIM,
            title="Request for Clarification / Follow-up Questions",
            legal_statute_ref="Section 179 BNSS",
            subject_template="URGENT: Clarification Needed regarding Statement in Case No. {{case_number}}",
            body_template="""Dear {{receiver_name}},

Ref: Case / FIR No. {{case_number}}

During the ongoing analysis of statement records for the above investigation, certain additional facts and timeline clarifications are required:

Specific Clarifications Required:
{{details}}

Kindly review these points and reply to this email with details or call the IO at {{officer_contact}} before {{deadline}}.

Regards,
{{investigating_officer}}
{{police_station}}""",
            required_vars=["case_number", "receiver_name", "details"]
        ))

        self.register_template(EmailTemplate(
            template_id="evidence_submission_directive",
            category=EmailCategory.WITNESS_VICTIM,
            title="Evidence Submission Directives",
            legal_statute_ref="Section 94 BNSS / Section 91 CrPC",
            subject_template="SECURE DIRECTIVE: Submission of Digital Evidence for FIR No. {{case_number}}",
            body_template="""Dear {{receiver_name}},

Ref: Investigation in FIR No. {{case_number}}

In furtherance of the ongoing investigation, you are requested to securely submit digital evidence (photos, video recordings, bank invoices, chat screenshots, or transaction receipts) relating to this incident.

Secure Upload Portal Link: {{secure_link}}
Access Code / Token: {{access_code}}
Submission Deadline: {{deadline}}

Instructions:
1. Do not edit, crop, or modify the original media files (preserve original EXIF metadata).
2. Upload files in PDF, ZIP, PNG, or MP4 formats.

Regards,
{{investigating_officer}}
{{police_station}}""",
            required_vars=["case_number", "receiver_name", "secure_link"]
        ))

        self.register_template(EmailTemplate(
            template_id="case_status_update",
            category=EmailCategory.WITNESS_VICTIM,
            title="Case Status Updates to Victim",
            legal_statute_ref="Victim Assistance Standard Procedure",
            subject_template="CASE STATUS UPDATE: Progress Report for FIR No. {{case_number}}",
            body_template="""Dear {{receiver_name}},

This is an official progress update regarding FIR No. {{case_number}} filed at {{police_station}}.

Key Investigation Milestones Achieved:
{{details}}

Current Status: {{current_status}}
Next Actions Scheduled: {{next_steps}}

If you have additional information to provide, please contact the IO at {{officer_contact}}.

Sincerely,
{{investigating_officer}}
{{police_station}}""",
            required_vars=["case_number", "receiver_name", "details"]
        ))

        # ======================================================================
        # CATEGORY 2: SUSPECTS OR ACCUSED PERSONS
        # ======================================================================
        self.register_template(EmailTemplate(
            template_id="notice_of_appearance_suspect",
            category=EmailCategory.SUSPECT_ACCUSED,
            title="Notice of Appearance / Directive to Join Investigation",
            legal_statute_ref="Section 35 BNSS / Section 41A CrPC",
            subject_template="LEGAL NOTICE UNDER SECTION 35 BNSS: Notice to Join Investigation in FIR No. {{case_number}}",
            body_template="""Dear {{receiver_name}},

NOTICE UNDER SECTION 35 BNSS (FORMERLY SECTION 41A CrPC)

WHEREAS your presence is required in connection with the investigation of FIR No. {{case_number}} registered at {{police_station}} under offences {{offence_type}}.

You are hereby directed to appear before the undersigned Investigating Officer on {{date_time}} at {{place_or_link}}.

Mandatory Directives:
1. You shall report to the IO as directed without fail.
2. You shall not tamper with evidence or threaten any witnesses directly or indirectly.
3. You shall render full cooperation in the investigation.

Failure to comply with this notice may lead to arrest under applicable statutory provisions.

Issued by:
{{investigating_officer}}
{{police_station}}
Date: {{current_date}}""",
            required_vars=["case_number", "receiver_name", "date_time"]
        ))

        self.register_template(EmailTemplate(
            template_id="demand_produce_documents",
            category=EmailCategory.SUSPECT_ACCUSED,
            title="Demand to Produce Documents / Digital Assets",
            legal_statute_ref="Section 94 BNSS / Section 91 CrPC",
            subject_template="SUMMONS TO PRODUCE DOCUMENTS / ASSETS: FIR No. {{case_number}}",
            body_template="""Dear {{receiver_name}},

NOTICE UNDER SECTION 94 BNSS / SECTION 91 CrPC

You are formally ordered to produce the following original records, accounts, financial ledgers, or digital hardware devices in your possession relevant to FIR No. {{case_number}}:

Required Records / Assets:
{{details}}

Submission Location: {{police_station}}
Deadline for Production: {{deadline}}

Take notice that failure to produce the required documents without lawful excuse is an offense punishable under law.

{{investigating_officer}}
{{police_station}}""",
            required_vars=["case_number", "receiver_name", "details"]
        ))

        self.register_template(EmailTemplate(
            template_id="lookout_warning_notice",
            category=EmailCategory.SUSPECT_ACCUSED,
            title="Lookout or Warning Notice",
            legal_statute_ref="BNSS / Bharatiya Nagarik Suraksha Sanhita Safeguards",
            subject_template="FORMAL INVESTIGATIVE WARNING NOTICE: FIR No. {{case_number}}",
            body_template="""Dear {{receiver_name}},

FORMAL WARNING & CAUTIONARY NOTICE

You are hereby officially informed that you are an active subject of investigation in FIR No. {{case_number}} at {{police_station}}.

RESTRICTIONS & CAUTIONS:
1. DO NOT attempt to leave the legal jurisdiction without prior written authorization from the Investigating Officer or Court.
2. DO NOT contact, intimidate, or influence any victims or witnesses.
3. DO NOT delete, alter, format, or destroy digital devices, cloud storage, financial logs, or communication backups.

Any violation of these directives will trigger immediate statutory apprehension and legal escalation.

{{investigating_officer}}
{{police_station}}""",
            required_vars=["case_number", "receiver_name"]
        ))

        # ======================================================================
        # CATEGORY 3: THIRD PARTIES (BANKS, TECH COMPANIES, TELECOMS)
        # ======================================================================
        self.register_template(EmailTemplate(
            template_id="legal_order_user_data",
            category=EmailCategory.THIRD_PARTY_INTERMEDIARY,
            title="Legal Orders for User Data / IP Logs / Metadata",
            legal_statute_ref="Section 94 BNSS / Section 91 CrPC & Section 79A IT Act",
            subject_template="OFFICIAL STATUTORY DEMAND FOR USER DATA: Case FIR No. {{case_number}} [Target: {{target_identifier}}]",
            body_template="""To,
The Nodal Officer / Law Enforcement Response Team
{{receiver_name}} ({{platform_or_company}})

RE: STATUTORY LEGAL ORDER FOR USER DATA IN POLICE INVESTIGATION
FIR No: {{case_number}}
Investigating Unit: {{police_station}}

Under statutory powers vested under Section 94 BNSS / Section 91 CrPC, you are hereby ordered to provide the following user account metadata and subscriber logs for target identifier: {{target_identifier}} (Email / Phone / Account ID / IP).

Data Required:
1. Subscriber registration details, verified mobile/email, billing address.
2. Complete IP login/logout timestamps (with UTC offsets) and port details for period {{date_range}}.
3. Linked recovery options, device identifiers, and payment method details.

Format: Please provide structured CSV / Excel or digital forensic PDF records.
Response Deadline: {{deadline}}

Authorizing Officer:
{{investigating_officer}}
Designation: Investigating Officer / Inspector of Police
{{police_station}}""",
            required_vars=["case_number", "receiver_name", "target_identifier"]
        ))

        self.register_template(EmailTemplate(
            template_id="data_preservation_request",
            category=EmailCategory.THIRD_PARTY_INTERMEDIARY,
            title="Emergency Data Preservation Request (180-Day Freeze)",
            legal_statute_ref="Section 91 CrPC / Section 94 BNSS Emergency Powers",
            subject_template="EMERGENCY 180-DAY DATA PRESERVATION ORDER: Account {{target_identifier}} [FIR {{case_number}}]",
            body_template="""To,
Law Enforcement Compliance Division
{{receiver_name}}

EMERGENCY PRESERVATION DIRECTIVE (CRIMINAL INVESTIGATION)

Pursuant to ongoing investigation into cyber fraud / criminal breach in FIR No. {{case_number}}, you are urgently directed to PRESERVE and FREEZE all server logs, account data, communication records, and backups associated with:

Target Identifier: {{target_identifier}}
Preservation Period: 180 Days starting {{current_date}}

Do NOT delete, overwrite, or truncate any server logs, IP records, or messages pending receipt of a formal judicial warrant/order.

Issued by:
{{investigating_officer}}
{{police_station}}""",
            required_vars=["case_number", "receiver_name", "target_identifier"]
        ))

        self.register_template(EmailTemplate(
            template_id="financial_freeze_order",
            category=EmailCategory.THIRD_PARTY_INTERMEDIARY,
            title="Financial Hold / Account Freeze Directive",
            legal_statute_ref="Section 106 BNSS / Section 102 CrPC (Seizure of Proceeds of Crime)",
            subject_template="URGENT FINANCIAL FREEZE ORDER: Account {{account_number}} - FIR No. {{case_number}}",
            body_template="""To,
The Nodal Officer / Fraud Control & Operations
{{receiver_name}} (Bank / Payment Gateway / Exchange)

STATUTORY ORDER TO FREEZE SUSPECT FINANCIAL ACCOUNT / BENEFICIARY

WHEREAS cyber fraud proceeds in FIR No. {{case_number}} have been traced to the following beneficiary account maintained with your institution:

Account / Wallet No: {{account_number}}
Account Holder Name: {{account_holder}}
IFSC / Gateway Ref: {{ifsc_or_ref}}
Disputed Fraud Amount: {{fraud_amount}}

You are hereby commanded under Section 106 BNSS / Section 102 CrPC to IMMEDIATELY FREEZE / DEBIT-FREEZE the aforementioned account and preserve the current balance.

Furthermore, provide the complete account statement (CSV format) from {{start_date}} to {{end_date}} along with KYC documentation.

Authorizing Officer:
{{investigating_officer}}
{{police_station}}""",
            required_vars=["case_number", "receiver_name", "account_number"]
        ))

        # ======================================================================
        # CATEGORY 4: OTHER AGENCIES & LEGAL AUTHORITIES
        # ======================================================================
        self.register_template(EmailTemplate(
            template_id="jurisdictional_transfer_note",
            category=EmailCategory.OTHER_AGENCY_LEGAL,
            title="Jurisdictional Transfer Note",
            legal_statute_ref="Police Manual Case Transfer Regulations",
            subject_template="OFFICIAL CASE TRANSFER: FIR No. {{case_number}} to {{agency_name}}",
            body_template="""To,
The Head of Unit / Station House Officer
{{agency_name}}

SUBJECT: OFFICIAL TRANSFER OF CASE FILE - FIR NO. {{case_number}}

Sir/Madam,

Please find enclosed the complete case summary, seized evidence inventory, and digital forensic reports for FIR No. {{case_number}} registered under {{offence_type}}.

Reason for Transfer:
{{details}}

The case file along with physical and digital exhibits is formally handed over to your unit for further investigation.

Transferring Officer:
{{investigating_officer}}
{{police_station}}""",
            required_vars=["case_number", "agency_name", "details"]
        ))

        self.register_template(EmailTemplate(
            template_id="mlat_request",
            category=EmailCategory.OTHER_AGENCY_LEGAL,
            title="Mutual Legal Assistance Request (MLAT / Interpol)",
            legal_statute_ref="Section 111 BNSS / MLAT Protocols / Interpol Red/Blue Notice",
            subject_template="INTERNATIONAL LEGAL ASSISTANCE (MLAT/INTERPOL): Request in FIR No. {{case_number}}",
            body_template="""To,
National Central Bureau (NCB) / International Police Cooperation Cell
{{agency_name}}

RE: FORMAL MUTUAL LEGAL ASSISTANCE REQUEST (MLAT)
Case FIR No: {{case_number}}
Jurisdiction: {{police_station}}

Requesting assistance from foreign law enforcement authorities in relation to offences committed under {{offence_type}}.

Target Entity / Suspect: {{target_identifier}}
Foreign Jurisdiction Involved: {{foreign_jurisdiction}}

Summary of Judicial Request:
{{details}}

Authorizing Officer:
{{investigating_officer}}
{{police_station}}""",
            required_vars=["case_number", "agency_name", "details"]
        ))

        self.register_template(EmailTemplate(
            template_id="prosecutional_court_update",
            category=EmailCategory.OTHER_AGENCY_LEGAL,
            title="Prosecutional / Court Updates & Charge Sheet Status",
            legal_statute_ref="Section 193 BNSS / Section 173 CrPC",
            subject_template="LEGAL PROSECUTION UPDATE: Status Report for FIR No. {{case_number}}",
            body_template="""To,
The Public Prosecutor / Court Master
{{agency_name}}

RE: SUBMISSION OF INVESTIGATION STATUS REPORT / DRAFT CHARGE SHEET - FIR NO. {{case_number}}

Sir/Madam,

Please find attached the latest status report, expert opinion reports (FSL/Cyber), and draft charge sheet under Section 193 BNSS in FIR No. {{case_number}}.

Summary of Court Submissions:
{{details}}

Next Scheduled Hearing / Action: {{date_time}}

Submitted by:
{{investigating_officer}}
{{police_station}}""",
            required_vars=["case_number", "agency_name", "details"]
        ))

        # ======================================================================
        # CATEGORY 5: CUSTOM / EXTENDED TOPIC FALLBACK
        # ======================================================================
        self.register_template(EmailTemplate(
            template_id="custom_extended_notice",
            category=EmailCategory.CUSTOM_EXTENDED,
            title="Custom / Extended Law Enforcement Directive",
            legal_statute_ref="Bharatiya Nagarik Suraksha Sanhita (BNSS)",
            subject_template="OFFICIAL POLICE COMMUNICATION: FIR No. {{case_number}} [{{subject_topic}}]",
            body_template="""Dear {{receiver_name}},

OFFICIAL COMMUNICATION FROM POLICE INVESTIGATION UNIT

Ref: FIR No. {{case_number}}
Topic: {{subject_topic}}

{{details}}

Action Required by Receiver:
{{action_required}}

Deadline: {{deadline}}

For queries, contact the undersigned officer.

Regards,
{{investigating_officer}}
{{police_station}}""",
            required_vars=["case_number", "receiver_name", "details"]
        ))
