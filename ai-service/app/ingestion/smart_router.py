import os
import json
import fitz  # PyMuPDF
import google.generativeai as genai
from PIL import Image
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

def process_multimodal_complaint(file_path: str = None, raw_text: str = None, input_type: str = "text") -> dict:
    """
    Multimodal Complaint Ingestion Engine.
    Extracts detailed bank entities (account_number, ifsc, bank, account_name) and multi-type entities.
    """
    extracted_text = raw_text or ""
    image_object = None
    audio_file_upload = None

    if file_path and os.path.exists(file_path):
        filename = os.path.basename(file_path).lower()

        if filename.endswith('.pdf') or input_type == 'pdf':
            extracted_text = extract_text_from_pdf(file_path)
            if len(extracted_text.strip()) < 50 and GEMINI_API_KEY:
                try:
                    doc = fitz.open(file_path)
                    page = doc.load_page(0)
                    pix = page.get_pixmap()
                    temp_img_path = file_path + "_page1.png"
                    pix.save(temp_img_path)
                    image_object = Image.open(temp_img_path)
                    doc.close()
                    extracted_text = "[Scanned PDF - Processing via Gemini Flash Vision OCR]"
                except Exception as e:
                    print(f"[-] Scanned PDF Vision Conversion Error: {e}")
                    if not ENABLE_DEMO_FALLBACKS:
                        raise e

        elif any(filename.endswith(ext) for ext in ['.jpg', '.jpeg', '.png', '.bmp']) or input_type == 'image':
            try:
                image_object = Image.open(file_path)
                extracted_text = f"[Image File {filename} - Processing via Gemini Flash Vision OCR]"
            except Exception as e:
                print(f"[-] Image Loading Error: {e}")
                if not ENABLE_DEMO_FALLBACKS:
                    raise e

        elif any(filename.endswith(ext) for ext in ['.wav', '.mp3', '.m4a', '.ogg']) or input_type == 'audio':
            if GEMINI_API_KEY:
                try:
                    print(f"[*] Uploading audio file to Gemini ASR API: {file_path}")
                    audio_file_upload = genai.upload_file(path=file_path)
                    extracted_text = f"[Audio File {filename} - Processing via Gemini Multimodal ASR]"
                except Exception as e:
                    print(f"[-] Gemini Audio ASR Upload Error: {e}")
                    if not ENABLE_DEMO_FALLBACKS:
                        raise e
                    extracted_text = f"[Audio Voice Recording: Gujarati/Hindi complaint regarding UPI fraud]"

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
   - bank_accounts: list of objects with "account_number", "ifsc", "bank", "account_name" (or plain strings if partial)
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
  "crime_sub_type": "...",
  "severity_score": 7.5,
  "entities": {{
    "persons": [{{"name": "...", "role": "victim|accused"}}],
    "phone_numbers": [],
    "email_addresses": [],
    "bank_accounts": [
      {{
        "account_number": "<ACCOUNT_NUMBER>",
        "ifsc": "<IFSC_CODE>",
        "bank": "<BANK_NAME>",
        "account_name": "<ACCOUNT_HOLDER_NAME>"
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
        if GEMINI_API_KEY and (image_object or audio_file_upload):
            model = genai.GenerativeModel("gemini-1.5-flash")
            inputs = [prompt_text]
            if image_object:
                inputs.append(image_object)
            if audio_file_upload:
                inputs.append(audio_file_upload)
            
            res = model.generate_content(inputs)
            response_text = res.text
        else:
            llm = get_agent_llm("auto", temperature=0.1)
            resp = llm.invoke(prompt_text)
            response_text = resp.content if hasattr(resp, 'content') else str(resp)

        data = parse_llm_json(response_text, schema_model=ComplaintIngestionSchema)
        data['raw_text'] = extracted_text
        return data

    except Exception as e:
        print(f"[-] Smart Router Ingestion Exception: {e}")
        if not ENABLE_DEMO_FALLBACKS:
            raise e
        return ComplaintIngestionSchema(
            original_language="gu",
            translated_text=extracted_text or "Victim reported unauthorized transaction of Rs. 85,000 via fraudulent UPI link.",
            raw_text=extracted_text
        ).model_dump()
