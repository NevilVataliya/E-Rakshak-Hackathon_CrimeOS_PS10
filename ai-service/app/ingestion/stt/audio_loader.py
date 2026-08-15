import numpy as np

class AudioLoader:
    def __init__(self, sample_rate: int = 16000):
        self.sample_rate = sample_rate

    def load(self, path: str):
        try:
            import librosa
            audio, sr = librosa.load(
                path,
                sr=self.sample_rate,
                mono=True,
            )
            return audio.astype(np.float32), sr
        except Exception:
            import soundfile as sf
            audio, sr = sf.read(path)
            if len(audio.shape) > 1:
                audio = audio.mean(axis=1)
            if sr != self.sample_rate:
                import scipy.signal
                num_samples = int(len(audio) * float(self.sample_rate) / sr)
                audio = scipy.signal.resample(audio, num_samples)
                sr = self.sample_rate
            return audio.astype(np.float32), sr
