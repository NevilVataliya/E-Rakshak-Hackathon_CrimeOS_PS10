from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional, Union

# --- 1. COMPLAINT INGESTION SCHEMA ---
class PersonEntity(BaseModel):
    name: Optional[str] = Field(default=None)
    role: Optional[str] = Field(default=None)

class BankAccountSchema(BaseModel):
    account_number: Optional[str] = Field(default=None)
    ifsc: Optional[str] = Field(default=None)
    bank: Optional[str] = Field(default=None)
    account_name: Optional[str] = Field(default=None)
    account_role: Optional[str] = Field(default="accused") # "victim" or "accused"
    is_victim_account: Optional[bool] = Field(default=False)

class EntitiesSchema(BaseModel):
    persons: List[PersonEntity] = Field(default_factory=list)
    phone_numbers: List[str] = Field(default_factory=list)
    email_addresses: List[str] = Field(default_factory=list)
    online_handles: List[str] = Field(default_factory=list)
    bank_accounts: List[Union[BankAccountSchema, Dict[str, Any], str]] = Field(default_factory=list)
    vpas_upis: List[str] = Field(default_factory=list)
    monetary_loss: float = Field(default=0.0)
    crime_locations: List[str] = Field(default_factory=list)
    date_time_of_incident: Optional[str] = Field(default=None)

class ComplaintIngestionSchema(BaseModel):
    original_language: Optional[str] = Field(default=None)
    translated_text: Optional[str] = Field(default=None)
    crime_category: Optional[str] = Field(default=None)
    crime_sub_type: Optional[str] = Field(default=None)
    severity_score: float = Field(default=5.0)
    entities: EntitiesSchema = Field(default_factory=EntitiesSchema)
    key_facts: List[str] = Field(default_factory=list)
    raw_text: Optional[str] = Field(default=None)


# --- 2. BNS LEGAL AGENT SCHEMA ---
class BNSSectionItem(BaseModel):
    code: Optional[str] = Field(default=None)
    title: Optional[str] = Field(default=None)
    rationale: Optional[str] = Field(default=None)
    source_document: Optional[str] = Field(default=None)
    page_number: Optional[str] = Field(default=None)

class BNSDraftSchema(BaseModel):
    bns_sections: List[BNSSectionItem] = Field(default_factory=list)
    punishment_duration: Optional[str] = Field(default=None)
    cognizability: Optional[str] = Field(default=None)
    legal_note: Optional[str] = Field(default=None)


# --- 3. BSA EVIDENCE AGENT SCHEMA ---
class BSARequirementItem(BaseModel):
    rule: Optional[str] = Field(default=None)
    description: Optional[str] = Field(default=None)
    source_document: Optional[str] = Field(default=None)
    page_number: Optional[str] = Field(default=None)

class BSADraftSchema(BaseModel):
    bsa_requirements: List[BSARequirementItem] = Field(default_factory=list)
    mandatory_checklists: List[str] = Field(default_factory=list)


# --- 4. CYBER SPECIALIST & INVESTIGATION STEP SCHEMAS ---
class InvestigationStepItem(BaseModel):
    title: Optional[str] = Field(default=None)
    description: Optional[str] = Field(default=None)
    category: Optional[str] = Field(default=None)
    sop_reference: Optional[str] = Field(default=None)

class LegalRequestItem(BaseModel):
    request_type: Optional[str] = Field(default=None)
    target_provider: Optional[str] = Field(default=None)
    purpose: Optional[str] = Field(default=None)

class CyberDraftSchema(BaseModel):
    digital_directives: List[Union[InvestigationStepItem, Dict[str, Any], str]] = Field(default_factory=list)
    recommended_legal_requests: List[LegalRequestItem] = Field(default_factory=list)


# --- 5. CONVENTIONAL FIELD SCHEMA ---
class ConventionalDraftSchema(BaseModel):
    field_steps: List[Union[InvestigationStepItem, Dict[str, Any], str]] = Field(default_factory=list)


# --- 6. RESPONSE ANALYTICS SCHEMA ---
class BPartyItem(BaseModel):
    phone: Optional[str] = Field(default=None)
    call_count: int = Field(default=0)
    total_duration_min: int = Field(default=0)

class TowerItem(BaseModel):
    tower_id: Optional[str] = Field(default=None)
    location_name: Optional[str] = Field(default=None)
    frequency: int = Field(default=0)

class ResponseAnalyticsSchema(BaseModel):
    total_records: int = Field(default=0)
    response_type: Optional[str] = Field(default=None)
    top_b_parties: List[BPartyItem] = Field(default_factory=list)
    top_tower_locations: List[TowerItem] = Field(default_factory=list)
    night_calls_count: int = Field(default=0)
    imei_history: List[str] = Field(default_factory=list)
    executive_summary: Optional[str] = Field(default=None)
    recommended_next_action: Optional[str] = Field(default=None)
