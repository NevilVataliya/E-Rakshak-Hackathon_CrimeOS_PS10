import abc
from typing import Dict, Any

class BaseFileProcessor(abc.ABC):
    """
    Abstract Base Class for all multimodal input file processors.
    Supports both offline local processing and online cloud-enhanced modes.
    """

    @abc.abstractmethod
    def can_handle(self, file_extension: str) -> bool:
        """Determines if this processor can handle the given file extension."""
        pass

    @abc.abstractmethod
    def extract_content(self, file_path: str, offline_mode: bool = False) -> Dict[str, Any]:
        """
        Extracts text content or transcription from the target file.
        Returns a dict containing:
        - content: extracted text or markdown string
        - engine_used: identifier of the processing model/library used
        - is_offline: boolean indicating if processing was executed 100% offline
        - warning: optional warning string if fallbacks or limitations occurred
        """
        pass

    @property
    @abc.abstractmethod
    def output_key(self) -> str:
        """The key name mapped in the consolidated extracted dictionary."""
        pass
