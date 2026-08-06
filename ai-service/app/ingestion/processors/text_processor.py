import os
from typing import Dict, Any
from app.ingestion.base_processor import BaseFileProcessor

class TextProcessor(BaseFileProcessor):
    def can_handle(self, file_extension: str) -> bool:
        return file_extension.lower() in ['.txt', '.md', '.csv']

    def extract_content(self, file_path: str, offline_mode: bool = False) -> Dict[str, Any]:
        filename = os.path.basename(file_path)
        try:
            with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                content = f.read()
            return {
                "content": content,
                "engine_used": "local_text_reader",
                "is_offline": True,
                "warning": None
            }
        except Exception as e:
            return {
                "content": f"[!] Error reading text file ({filename}): {str(e)}",
                "engine_used": "local_text_reader_failed",
                "is_offline": True,
                "warning": str(e)
            }

    @property
    def output_key(self) -> str:
        return "text"
