from dataclasses import dataclass, field
from typing import Optional, List
import numpy as np

@dataclass(slots=True)
class Word:
    text: str
    start: Optional[float]
    end: Optional[float]
    probability: Optional[float]

@dataclass(slots=True)
class Segment:
    id: int
    start: float
    end: float
    text: str
    avg_logprob: Optional[float] = None
    no_speech_prob: Optional[float] = None
    compression_ratio: Optional[float] = None
    words: List[Word] = field(default_factory=list)

@dataclass(slots=True)
class SpeechRegion:
    start: float
    end: float
    sample_start: int
    sample_end: int

@dataclass(slots=True)
class SpeechChunk:
    id: int
    start: float
    end: float
    sample_start: int
    sample_end: int
    audio: np.ndarray

@dataclass(slots=True)
class TranscriptionResult:
    engine: str
    language: str | None
    language_probability: float | None
    duration: float
    text: str
    segments: List[Segment]
    processing_time: float | None = None
    chunk_count: int = 1
    average_logprob: float | None = None
