import os
from typing import Dict, Any
from app.ingestion.base_processor import BaseFileProcessor
from config import GEMINI_API_KEY

class AudioProcessor(BaseFileProcessor):
    def can_handle(self, file_extension: str) -> bool:
        return file_extension.lower() in ['.wav', '.mp3', '.m4a', '.flac', '.ogg']

    def extract_content(self, file_path: str, offline_mode: bool = False) -> Dict[str, Any]:
        filename = os.path.basename(file_path)

        # 1. Attempt local Faster-Whisper / Speech-to-Text transcription (Offline Capable)
        try:
            from faster_whisper import WhisperModel
            model = WhisperModel("small", device="cpu", compute_type="int8")
            segments, info = model.transcribe(file_path, beam_size=5, vad_filter=True)
            transcript = " ".join([s.text.strip() for s in segments if s.text]).strip()
            if transcript:
                return {
                    "content": f"[Audio Transcription ({filename}) - Local Whisper STT ({info.language})]:\n{transcript}",
                    "engine_used": f"faster_whisper_{info.language}",
                    "is_offline": True,
                    "warning": None
                }
        except Exception:
            pass  # Local Whisper not installed or failed

        # 2. Cloud Gemini ASR Ingestion if online mode and GEMINI_API_KEY is active
        if not offline_mode and GEMINI_API_KEY:
            try:
                import google.generativeai as genai
                genai.configure(api_key=GEMINI_API_KEY)
                print(f"[*] Uploading audio {filename} to Gemini ASR API...")
                audio_file = genai.upload_file(path=file_path)
                
                model = genai.GenerativeModel("gemini-1.5-flash")
                res = model.generate_content([
                    "Listen carefully to this audio recording of a police complaint in Gujarati, Hindi, or English. Transcribe the spoken text accurately in English.",
                    audio_file
                ])
                if res.text:
                    return {
                        "content": f"[Audio Transcription ({filename}) - Gemini Cloud ASR]:\n{res.text}",
                        "engine_used": "gemini_cloud_asr",
                        "is_offline": False,
                        "warning": None
                    }
            except Exception as e:
                return {
                    "content": f"[Audio Recording {filename} attached - Cloud ASR Error: {str(e)}]",
                    "engine_used": "gemini_asr_failed",
                    "is_offline": False,
                    "warning": f"Gemini Cloud ASR failed: {str(e)}"
                }

        # 3. Offline Mode without local Whisper model pre-installed
        return {
            "content": f"[Audio Recording {filename} attached - STT pending]",
            "engine_used": "audio_stub",
            "is_offline": True,
            "warning": "Offline Mode active: Local Whisper model or Gemini API key required for Speech-to-Text transcription."
        }

    @property
    def output_key(self) -> str:
        return "audio"
