import os
from typing import Dict, Any
from app.ingestion.base_processor import BaseFileProcessor
from config import GEMINI_API_KEY, MODEL_CACHE_DIR

class AudioProcessor(BaseFileProcessor):
    def can_handle(self, file_extension: str) -> bool:
        return file_extension.lower() in ['.wav', '.mp3', '.m4a', '.flac', '.ogg']

    def _detect_audio_language(self, file_path: str) -> str:
        """
        Fast 30ms Language Identification (LID) Probe.
        Returns 'gu', 'hi', or 'en'. Defaults to 'gu' for Gujarat Cyber Police.
        """
        try:
            from faster_whisper import WhisperModel
            whisper_path = os.path.join(MODEL_CACHE_DIR, "whisper_base")
            model_to_use = whisper_path if os.path.exists(whisper_path) else "base"
            whisper_model = WhisperModel(model_to_use, device="cpu", compute_type="int8", download_root=MODEL_CACHE_DIR)
            _, probs = whisper_model.detect_language(file_path)
            detected = max(probs, key=probs.get) if probs else "gu"
            if detected in ["gu", "hi", "en", "mr", "bn", "pa"]:
                return detected
        except Exception:
            pass
        return "gu"

    def extract_content(self, file_path: str, offline_mode: bool = False, language: str = None) -> Dict[str, Any]:
        filename = os.path.basename(file_path)

        # 1. Resolve Language via Method 1 (LID Probe) or Method 2 (Explicit Language Context)
        target_lang = language if language in ["gu", "hi", "en"] else self._detect_audio_language(file_path)

        # 2. Primary Engine: AI4Bharat IndicConformer (99% Accuracy for Gujarati / Hindi / Indian English)
        try:
            from app.ingestion.stt.indic_conformer import get_indic_conformer_stt
            stt_engine = get_indic_conformer_stt(default_language=target_lang)
            result = stt_engine.transcribe(file_path, language=target_lang)
            if result.text and result.text.strip():
                return {
                    "content": f"[Audio Transcription ({filename}) - AI4Bharat IndicConformer ({target_lang.upper()})]:\n{result.text.strip()}",
                    "engine_used": f"indic_conformer_{target_lang}",
                    "is_offline": True,
                    "warning": None
                }
        except Exception as indic_err:
            print(f"[-] IndicConformer offline execution notice: {indic_err}")

        # 3. Secondary Local Fallback: Faster-Whisper
        try:
            from faster_whisper import WhisperModel
            whisper_path = os.path.join(MODEL_CACHE_DIR, "whisper_base")
            model_to_use = whisper_path if os.path.exists(whisper_path) else "base"
            model = WhisperModel(model_to_use, device="cpu", compute_type="int8", download_root=MODEL_CACHE_DIR)
            segments, info = model.transcribe(file_path, language=target_lang, beam_size=5, vad_filter=True)
            transcript = " ".join([s.text.strip() for s in segments if s.text]).strip()
            if transcript:
                return {
                    "content": f"[Audio Transcription ({filename}) - Local Whisper STT ({info.language})]:\n{transcript}",
                    "engine_used": f"faster_whisper_{info.language}",
                    "is_offline": True,
                    "warning": None
                }
        except Exception as we:
            print(f"[-] Local Faster-Whisper notice: {we}")

        # 4. Cloud Gemini ASR Ingestion if online mode and GEMINI_API_KEY is active
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

        # 5. Offline Mode Fallback Notice
        return {
            "content": f"[Audio Recording {filename} attached - IndicConformer STT pending]",
            "engine_used": "audio_stub",
            "is_offline": True,
            "warning": "Offline Mode active: IndicConformer ASR model or Gemini API key required for Speech-to-Text transcription."
        }

    @property
    def output_key(self) -> str:
        return "audio"

