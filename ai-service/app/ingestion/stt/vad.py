from app.ingestion.stt.models import SpeechRegion

class VoiceActivityDetector:
    def __init__(
        self,
        threshold: float = 0.5,
        min_speech_ms: int = 250,
        min_silence_ms: int = 150,
    ):
        self.threshold = threshold
        self.min_speech_ms = min_speech_ms
        self.min_silence_ms = min_silence_ms
        self._model = None

    @property
    def model(self):
        if self._model is None:
            try:
                from silero_vad import load_silero_vad
                self._model = load_silero_vad()
            except Exception as e:
                print(f"[-] Silero VAD load notice: {e}")
                self._model = None
        return self._model

    def detect(self, audio, sample_rate: int):
        if self.model is None:
            # Fallback if silero_vad is not available: return single full audio region
            total_duration = len(audio) / sample_rate
            return [SpeechRegion(start=0.0, end=total_duration, sample_start=0, sample_end=len(audio))]

        try:
            from silero_vad import get_speech_timestamps
            timestamps = get_speech_timestamps(
                audio,
                self.model,
                sampling_rate=sample_rate,
                threshold=self.threshold,
                min_speech_duration_ms=self.min_speech_ms,
                min_silence_duration_ms=self.min_silence_ms,
            )

            regions = []
            for ts in timestamps:
                regions.append(
                    SpeechRegion(
                        start=ts["start"] / sample_rate,
                        end=ts["end"] / sample_rate,
                        sample_start=ts["start"],
                        sample_end=ts["end"],
                    )
                )
            if not regions:
                total_duration = len(audio) / sample_rate
                return [SpeechRegion(start=0.0, end=total_duration, sample_start=0, sample_end=len(audio))]
            return regions
        except Exception as e:
            print(f"[-] VAD detect fallback: {e}")
            total_duration = len(audio) / sample_rate
            return [SpeechRegion(start=0.0, end=total_duration, sample_start=0, sample_end=len(audio))]
