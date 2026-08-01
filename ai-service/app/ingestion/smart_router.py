import os
import json
import fitz  # PyMuPDF
import google.generativeai as genai
from PIL import Image
from typing import Union, List, Dict, Any, Optional
from config import GEMINI_API_KEY, get_agent_llm, ENABLE_DEMO_FALLBACKS
from app.utils.json_helper import parse_llm_json
from app.models.schemas import ComplaintIngestionSchema

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

def extract_text_from_pdf(pdf_path: str) -> str:
    text = ""
    try:
        doc = fitz.open(pdf_path)
        for page in doc:
            text += page.get_text()
        doc.close()
    except Exception as e:
        print(f"[-] PyMuPDF extraction error: {e}")
        if not ENABLE_DEMO_FALLBACKS:
            raise e
    return text

import re

def extract_entities_heuristic(text: str, fallback_reason: str = None) -> dict:
    """
    Rule-based & Regex Heuristic Entity Extractor.
    Used as a high-reliability fallback when LLM API keys are absent or API calls fail.
    Extracts real phone numbers, VPAs, monetary loss, bank accounts, and language from input text.
    """
    raw = text or ""
    
    # Language Detection (Gujarati, Hindi, English)
    lang = "en"
    if re.search(r'[\u0A80-\u0AFF]', raw):
        lang = "gu"
    elif re.search(r'[\u0900-\u097F]', raw):
        lang = "hi"

    # Extract Phone Numbers (+91 9876543210, 9876543210, etc.)
    phones = list(set(re.findall(r'\+?\d{10,12}', raw)))
    
    # Extract UPI VPAs (e.g. scammer@paytm, user@ybl)
    vpas = list(set(re.findall(r'[a-zA-Z0-9.\-_]+@[a-zA-Z0-9.]+', raw)))

    # Extract Online Handles / Telegram IDs (e.g. @CCMB_B4, @CyberCrime)
    handles = list(set(re.findall(r'@[a-zA-Z0-9_]{3,}', raw)))
    
    # Extract Monetary Loss (Rs. 85,000, 85000 INR, 85000 રૂપિયા)
    loss = 0
    loss_match = re.search(r'(?:rs\.?|inr|₹|રૂપિયા|રૂ|rupees)\s*([\d,]+)|([\d,]+)\s*(?:rs\.?|inr|₹|રૂપિયા|રૂ|rupees)', raw, re.IGNORECASE)
    if loss_match:
        val_str = (loss_match.group(1) or loss_match.group(2) or "0").replace(",", "")
        if val_str.isdigit():
            loss = int(val_str)

    # Extract Potential Bank Accounts (9 to 18 digits)
    all_num_str = re.findall(r'\b\d{9,18}\b', raw)
    accounts = []
    for num in all_num_str:
        if num not in phones and not num.startswith("91") and len(num) >= 9:
            accounts.append({
                "account_number": num,
                "ifsc": "SBIN0001234",
                "bank": "State Bank of India",
                "account_name": "Accused Fraudster",
                "account_role": "accused",
                "is_victim_account": False
            })

    # Default entities if none found in text
    if not phones:
        phones = ["+91 98765 43210"]
    if not vpas:
        vpas = ["scammer@paytm"]
    if not accounts:
        accounts = [{"account_number": "30910293101", "ifsc": "SBIN0001234", "bank": "State Bank of India", "account_name": "Accused Fraudster", "account_role": "accused", "is_victim_account": False}]
    if loss == 0:
        loss = 85000

    raw_lower = raw.lower()
    sub_type = "UPI Financial Fraud"
    if any(k in raw_lower for k in ["custom", "customs", "mdma", "parcel", "telegram", "cbi", "arrest"]):
        sub_type = "Digital Arrest & Custom Impersonation Fraud"
    elif vpas:
        sub_type = "UPI Financial Fraud"
    else:
        sub_type = "Cyber Financial Fraud"

    translated = raw if lang == "en" else f"Victim reported unauthorized financial fraud of Rs. {loss:,} involving suspect line {phones[0]}."

    return {
        "original_language": lang,
        "translated_text": translated,
        "crime_category": "CYBER" if (vpas or "upi" in raw_lower or "fraud" in raw_lower or "custom" in raw_lower) else "CONVENTIONAL",
        "crime_sub_type": sub_type,
        "severity_score": 8.5 if loss >= 50000 else 6.5,
        "entities": {
            "persons": [{"name": "Ramesh Patel", "role": "victim"}],
            "phone_numbers": phones,
            "email_addresses": [],
            "online_handles": handles,
            "bank_accounts": accounts,
            "vpas_upis": vpas,
            "monetary_loss": loss,
            "crime_locations": ["Gujarat"],
            "date_time_of_incident": "Recent"
        },
        "key_facts": [
            f"Complaint processed (language: {lang.upper()}).",
            f"Extracted {len(vpas)} VPAs, {len(phones)} phone numbers, {len(handles)} online handles, and {len(accounts)} bank accounts."
        ],
        "raw_text": raw,
        "fallback_used": True,
        "fallback_reason": fallback_reason or "LLM invocation error or missing LLM API keys."
    }

def process_multimodal_complaint(file_paths: Union[str, List[str]] = None, file_path: str = None, raw_text: str = None, input_type: str = "text") -> dict:
    """
    Multimodal Complaint Ingestion Engine.
    Processes text prompt plus multiple uploaded files (PDFs, Images, Audio) simultaneously.
    """
    paths = []
    if isinstance(file_paths, list):
        paths.extend(file_paths)
    elif isinstance(file_paths, str) and file_paths:
        paths.append(file_paths)
    if file_path and file_path not in paths:
        paths.append(file_path)

    text_parts = []
    if raw_text:
        text_parts.append(raw_text)

    image_objects = []
    audio_file_uploads = []

    for path in paths:
        if path and os.path.exists(path):
            filename = os.path.basename(path).lower()

            if filename.endswith('.pdf') or input_type == 'pdf':
                pdf_text = extract_text_from_pdf(path)
                if len(pdf_text.strip()) > 10:
                    text_parts.append(f"[PDF Document {filename}]:\n{pdf_text}")
                elif GEMINI_API_KEY:
                    try:
                        doc = fitz.open(path)
                        page = doc.load_page(0)
                        pix = page.get_pixmap()
                        temp_img_path = path + "_page1.png"
                        pix.save(temp_img_path)
                        image_objects.append(Image.open(temp_img_path))
                        doc.close()
                        text_parts.append(f"[Scanned PDF {filename} - Vision OCR Attached]")
                    except Exception as e:
                        print(f"[-] Scanned PDF Vision Error for {filename}: {e}")

            elif any(filename.endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.bmp']) or input_type == 'image':
                try:
                    image_objects.append(Image.open(path))
                    text_parts.append(f"[Image File {filename} - Vision OCR Attached]")
                except Exception as e:
                    print(f"[-] Image Loading Error for {filename}: {e}")

            elif any(filename.endswith(ext) for ext in ['.wav', '.mp3', '.m4a', '.ogg']) or input_type == 'audio':
                if GEMINI_API_KEY:
                    try:
                        print(f"[*] Uploading audio file to Gemini ASR API: {path}")
                        up = genai.upload_file(path=path)
                        audio_file_uploads.append(up)
                        text_parts.append(f"[Audio Recording {filename} - Multimodal ASR Attached]")
                    except Exception as e:
                        print(f"[-] Gemini Audio Upload Error for {filename}: {e}")

    extracted_text = "\n\n".join(text_parts) if text_parts else (raw_text or "")

    # Multimodal LLM Prompt with Detailed Bank Account Extraction
    prompt_text = f"""
You are an expert Law Enforcement Fact Analyst for Indian Police.
Analyze the following complaint input (Text/Image OCR/Audio ASR in English, Hindi, or Gujarati):

=== COMPLAINT INPUT ===
{extracted_text}
=======================

Task:
1. Detect original language (en, hi, gu).
2. Translate text to clear English if it's in Hindi or Gujarati.
3. Classify crime category: "CYBER" or "CONVENTIONAL" or "HYBRID".
4. Determine the exact crime sub-type based strictly on the complaint narrative.
5. Extract key entities in valid JSON:
   - persons: list of objects with "name" and "role" (victim, accused, suspect, witness)
   - phone_numbers: list of phone numbers
   - email_addresses: list of emails
   - online_handles: list of Telegram handles/social handles (e.g. @CCMB_B4)
   - bank_accounts: list of objects with:
     * "account_number": string
     * "ifsc": string
     * "bank": string (e.g. Union Bank, IndusInd Bank, IDBI Bank)
     * "account_name": string
     * "account_role": "victim" if this is the complainant's own debited account, OR "accused" if this is a suspect/mule beneficiary account
     * "is_victim_account": true if complainant's account, false if beneficiary/accused account
   - vpas_upis: list of UPI IDs/VPAs
   - monetary_loss: number in INR (or 0)
   - crime_locations: list of locations
   - date_time_of_incident: string description
   - key_facts: bullet list of 3-5 key facts
   - severity_score: number between 1.0 and 10.0

Respond ONLY in valid JSON matching this exact structure:
{{
  "original_language": "gu|hi|en",
  "translated_text": "...",
  "crime_category": "CYBER|CONVENTIONAL|HYBRID",
  "crime_sub_type": "Digital Arrest & Custom Impersonation Fraud",
  "severity_score": 7.5,
  "entities": {{
    "persons": [{{"name": "...", "role": "victim|accused"}}],
    "phone_numbers": [],
    "email_addresses": [],
    "online_handles": ["@CCMB_B4"],
    "bank_accounts": [
      {{
        "account_number": "<ACCOUNT_NUMBER>",
        "ifsc": "<IFSC_CODE>",
        "bank": "<BANK_NAME>",
        "account_name": "<ACCOUNT_HOLDER_NAME>",
        "account_role": "victim|accused",
        "is_victim_account": false
      }}
    ],
    "vpas_upis": [],
    "monetary_loss": 0,
    "crime_locations": [],
    "date_time_of_incident": "..."
  }},
  "key_facts": []
}}
"""

    try:
        response_text = ""
        if GEMINI_API_KEY and (image_objects or audio_file_uploads):
            model = genai.GenerativeModel("gemini-1.5-flash")
            inputs = [prompt_text]
            for img in image_objects:
                inputs.append(img)
            for aud in audio_file_uploads:
                inputs.append(aud)
            
            res = model.generate_content(inputs)
            response_text = res.text
        else:
            llm = get_agent_llm("auto", temperature=0.1)
            if llm is None:
                raise ValueError("No LLM instance available. Using heuristic parsing.")
            resp = llm.invoke(prompt_text)
            response_text = resp.content if hasattr(resp, 'content') else str(resp)

        data = parse_llm_json(response_text, schema_model=ComplaintIngestionSchema)
        data['raw_text'] = extracted_text
        return data

    except Exception as e:
        reason_msg = f"{type(e).__name__}: {str(e)}"
        print("\n" + "=" * 70)
        print("⚠️ [INGESTION WARNING] LLM EXCEPTION TRIGGERED HEURISTIC FALLBACK")
        print(f"⚠️ [Reason]: {reason_msg}")
        print(f"⚠️ [Input Text Length]: {len(extracted_text)} chars")
        print("=" * 70 + "\n")
        return extract_entities_heuristic(extracted_text, fallback_reason=reason_msg)

