from app.ingestion.stt.models import SpeechRegion, SpeechChunk
import numpy as np

class SmartChunker:
    def __init__(
        self,
        target_duration: float = 12.0,   # Target chunk duration
        max_duration: float = 18.0,      # Hard limit for IndicConformer
        sample_rate: int = 16000,
    ):
        self.target_duration = target_duration
        self.max_duration = max_duration
        self.sample_rate = sample_rate

    def chunk(self, audio, regions: list[SpeechRegion]) -> list[SpeechChunk]:
        if not regions:
            total_duration = len(audio) / self.sample_rate
            regions = [SpeechRegion(start=0.0, end=total_duration, sample_start=0, sample_end=len(audio))]

        # Safety Net: Split any region exceeding max_duration
        safe_regions = []
        for r in regions:
            duration = r.end - r.start
            if duration > self.max_duration:
                num_splits = int(np.ceil(duration / self.target_duration))
                split_len = duration / num_splits
                for s in range(num_splits):
                    s_start = r.start + (s * split_len)
                    s_end = min(r.end, s_start + split_len)
                    safe_regions.append(SpeechRegion(
                        start=s_start,
                        end=s_end,
                        sample_start=int(s_start * self.sample_rate),
                        sample_end=int(s_end * self.sample_rate)
                    ))
            else:
                safe_regions.append(r)

        regions = safe_regions
        chunks = []
        chunk_id = 0

        current_start = regions[0].start
        current_end = regions[0].end

        i = 1
        while i < len(regions):
            region = regions[i]
            proposed_end = region.end
            duration = proposed_end - current_start

            if duration < self.target_duration:
                current_end = proposed_end
                i += 1
                continue

            if duration <= self.max_duration:
                chunks.append(self._build_chunk(chunk_id, current_start, proposed_end, audio))
                chunk_id += 1
                i += 1
                if i >= len(regions):
                    return chunks
                current_start = regions[i].start
                current_end = regions[i].end
                continue

            chunks.append(self._build_chunk(chunk_id, current_start, current_end, audio))
            chunk_id += 1
            current_start = region.start
            current_end = region.end
            i += 1

        chunks.append(self._build_chunk(chunk_id, current_start, current_end, audio))
        return chunks

    def _build_chunk(self, chunk_id: int, start: float, end: float, audio) -> SpeechChunk:
        pad = 0.1
        max_time = len(audio) / self.sample_rate

        start = max(0.0, start - pad)
        end = min(max_time, end + pad)

        sample_start = int(start * self.sample_rate)
        sample_end = int(end * self.sample_rate)

        return SpeechChunk(
            id=chunk_id,
            start=start,
            end=end,
            sample_start=sample_start,
            sample_end=sample_end,
            audio=audio[sample_start:sample_end],
        )
