from abc import ABC, abstractmethod
from app.ingestion.stt.models import TranscriptionResult

class SpeechToText(ABC):
    @abstractmethod
    def transcribe(
        self,
        audio_path: str,
        language: str | None = None,
    ) -> TranscriptionResult:
        pass
