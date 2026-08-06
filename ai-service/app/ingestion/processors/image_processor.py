import os
from typing import Dict, Any
from PIL import Image
from app.ingestion.base_processor import BaseFileProcessor
from config import GEMINI_API_KEY

class ImageProcessor(BaseFileProcessor):
    def can_handle(self, file_extension: str) -> bool:
        return file_extension.lower() in ['.jpg', '.jpeg', '.png', '.bmp', '.webp']

    def extract_content(self, file_path: str, offline_mode: bool = False) -> Dict[str, Any]:
        filename = os.path.basename(file_path)

        # 1. Local OCR Extraction (Tesseract OCR eng+hin+guj) - 100% Offline Capable
        ocr_text = ""
        try:
            import pytesseract
            img = Image.open(file_path)
            ocr_text = pytesseract.image_to_string(img, lang="eng+hin+guj").strip()
            if ocr_text and len(ocr_text.split()) >= 5:
                return {
                    "content": f"[Evidence Image ({filename}) - Local Tesseract OCR]:\n{ocr_text}",
                    "engine_used": "tesseract_local_ocr",
                    "is_offline": True,
                    "warning": None
                }
        except Exception:
            pass  # Tesseract not installed or failed

        # 2. Online Mode: Gemini Vision API zero-shot OCR & Forensic Analysis
        if not offline_mode and GEMINI_API_KEY:
            try:
                import google.generativeai as genai
                genai.configure(api_key=GEMINI_API_KEY)
                img = Image.open(file_path)
                model = genai.GenerativeModel("gemini-1.5-flash")
                res = model.generate_content([
                    "Analyze this forensic evidence image for a police investigation. Perform complete OCR extraction of all text, handwritten notes, timestamps, phone numbers, transaction VPAs, and bank account numbers visible.",
                    img
                ])
                if res.text:
                    return {
                        "content": f"[Evidence Image ({filename}) - Gemini Vision Analysis]:\n{res.text}",
                        "engine_used": "gemini_vision_ocr",
                        "is_offline": False,
                        "warning": None
                    }
            except Exception as e:
                pass

        # 3. Return local OCR text if we had any, or file attachment notice
        if ocr_text:
            return {
                "content": f"[Evidence Image ({filename}) - Partial Local OCR]:\n{ocr_text}",
                "engine_used": "partial_tesseract_ocr",
                "is_offline": True,
                "warning": None
            }

        return {
            "content": f"[Evidence Image {filename} attached]",
            "engine_used": "image_stub",
            "is_offline": True,
            "warning": "Offline Mode active: Tesseract OCR or Gemini Vision required for image text extraction."
        }

    @property
    def output_key(self) -> str:
        return "image"
