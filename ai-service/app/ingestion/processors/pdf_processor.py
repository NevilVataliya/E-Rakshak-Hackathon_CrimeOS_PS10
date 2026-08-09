import os
import io
from typing import Dict, Any
try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None

try:
    from PIL import Image
except ImportError:
    Image = None
from app.ingestion.base_processor import BaseFileProcessor
from config import GEMINI_API_KEY

def is_text_garbled(text_string: str) -> bool:
    """Detects bad PDF text encoding/garbled characters."""
    if not text_string or len(text_string.strip()) < 20:
        return True
    words = text_string.split()
    if not words:
        return True
    single_char_count = sum(1 for w in words if len(w) == 1)
    if (single_char_count / len(words)) > 0.35:
        return True
    return False

class PDFProcessor(BaseFileProcessor):
    def can_handle(self, file_extension: str) -> bool:
        return file_extension.lower() == '.pdf'

    def extract_content(self, file_path: str, offline_mode: bool = False) -> Dict[str, Any]:
        filename = os.path.basename(file_path)
        output_lines = []
        engine_used = "pymupdf_text"
        is_offline = True
        warnings = []

        try:
            # 1. Try PyMuPDF primary extraction
            if fitz is not None:
                doc = fitz.open(file_path)
                total_pages = len(doc)
                page_texts = []
                scanned_pages = []

                for idx, page in enumerate(doc):
                    text = page.get_text()
                    if not is_text_garbled(text):
                        page_texts.append(f"--- Page {idx + 1}/{total_pages} ---\n{text.strip()}")
                    else:
                        scanned_pages.append(idx)
                
                doc.close()

                if page_texts:
                    output_lines.extend(page_texts)

            # 2. Advanced pdfplumber & table extraction if available
            try:
                import pdfplumber
                with pdfplumber.open(file_path) as pdf:
                    for idx, p in enumerate(pdf.pages):
                        tables = p.extract_tables()
                        if tables:
                            output_lines.append(f"\n[Page {idx + 1} Tables Found]:")
                            for table in tables:
                                for row in table:
                                    row_str = " | ".join([str(cell).strip() if cell else "" for cell in row])
                                    if row_str.strip():
                                        output_lines.append(row_str)
                engine_used += "+pdfplumber_tables"
            except Exception as pe:
                pass  # pdfplumber optional fallback

            # 3. Handling scanned or garbled pages (Local OCR vs Cloud Gemini Vision)
            if scanned_pages:
                ocr_success = False
                # Try Local EasyOCR / Tesseract OCR first for offline capability
                try:
                    import pytesseract
                    doc = fitz.open(file_path)
                    for page_idx in scanned_pages:
                        page = doc.load_page(page_idx)
                        pix = page.get_pixmap(dpi=150)
                        img = Image.open(io.BytesIO(pix.tobytes()))
                        ocr_txt = pytesseract.image_to_string(img, lang="eng+hin+guj").strip()
                        if ocr_txt:
                            output_lines.append(f"--- Page {page_idx + 1} [Local Tesseract OCR] ---\n{ocr_txt}")
                    doc.close()
                    ocr_success = True
                    engine_used += "+tesseract_ocr"
                except Exception:
                    pass

                # If local OCR not available or empty and online mode is enabled with Gemini API key
                if not ocr_success and not offline_mode and GEMINI_API_KEY:
                    try:
                        import google.generativeai as genai
                        genai.configure(api_key=GEMINI_API_KEY)
                        model = genai.GenerativeModel("gemini-1.5-flash")
                        
                        doc = fitz.open(file_path)
                        for page_idx in scanned_pages:
                            page = doc.load_page(page_idx)
                            pix = page.get_pixmap(dpi=150)
                            img = Image.open(io.BytesIO(pix.tobytes()))
                            res = model.generate_content([
                                "Perform clear OCR text extraction for this Indian police FIR / complaint document page. Return extracted text.",
                                img
                            ])
                            if res.text:
                                output_lines.append(f"--- Page {page_idx + 1} [Gemini Vision OCR] ---\n{res.text}")
                        doc.close()
                        engine_used += "+gemini_vision_ocr"
                        is_offline = False
                    except Exception as ge:
                        warnings.append(f"Scanned PDF Vision OCR failed: {str(ge)}")

                if scanned_pages and offline_mode:
                    warnings.append(f"{len(scanned_pages)} pages appeared to be scanned images. Cloud OCR disabled in offline mode.")

            final_content = "\n\n".join(output_lines) if output_lines else f"[PDF Document {filename} processed]"

            return {
                "content": final_content,
                "engine_used": engine_used,
                "is_offline": is_offline,
                "warning": "; ".join(warnings) if warnings else None
            }

        except Exception as e:
            return {
                "content": f"[!] Error processing PDF ({filename}): {str(e)}",
                "engine_used": "pdf_processor_failed",
                "is_offline": True,
                "warning": str(e)
            }

    @property
    def output_key(self) -> str:
        return "pdf"
