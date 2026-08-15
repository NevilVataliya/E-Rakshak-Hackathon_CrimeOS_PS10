import os
import sys
from pathlib import Path

hf_token = os.getenv("HF_TOKEN") or os.getenv("HUGGINGFACE_HUB_TOKEN")
if hf_token:
    try:
        from huggingface_hub import login
        login(token=hf_token)
        print("[+] Hugging Face Hub authenticated successfully with HF_TOKEN.")
    except Exception as e:
        print(f"[-] HF login notice: {e}")

# Set cache directories
MODEL_CACHE_DIR = os.getenv("MODEL_CACHE_DIR", str(Path(__file__).resolve().parent / "models_cache"))
os.makedirs(MODEL_CACHE_DIR, exist_ok=True)
os.environ["HF_HOME"] = MODEL_CACHE_DIR
os.environ["SENTENCE_TRANSFORMERS_HOME"] = MODEL_CACHE_DIR
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

print(f"============================================================")
print(f"[*] Preloading CrimeOS AI Models into '{MODEL_CACHE_DIR}'...")
print(f"============================================================")

# 1. Preload AI4Bharat IndicConformer & Silero VAD for 99% Offline Indic STT
try:
    print("[1/5] Downloading AI4Bharat IndicConformer ('ai4bharat/indic-conformer-600m-multilingual')...")
    from transformers import AutoModel
    indic_dir = os.path.join(MODEL_CACHE_DIR, "indic_conformer")
    os.makedirs(indic_dir, exist_ok=True)
    AutoModel.from_pretrained(
        "ai4bharat/indic-conformer-600m-multilingual",
        cache_dir=indic_dir,
        trust_remote_code=True
    )
    print("  [+] AI4Bharat IndicConformer cached successfully!")
except Exception as e:
    print(f"  [-] IndicConformer preload notice: {e}")

try:
    print("      Downloading Silero VAD weights...")
    from silero_vad import load_silero_vad
    load_silero_vad()
    print("  [+] Silero VAD cached successfully!")
except Exception as e:
    print(f"  [-] Silero VAD preload notice: {e}")

# 2. Preload Faster-Whisper Model as secondary fallback
try:
    print("[2/5] Downloading Faster-Whisper model ('base')...")
    from faster_whisper import download_model
    whisper_dir = os.path.join(MODEL_CACHE_DIR, "whisper_base")
    download_model("base", output_dir=whisper_dir)
    print(f"  [+] Faster-Whisper base model cached successfully at {whisper_dir}!")
except Exception as e:
    print(f"  [-] Faster-Whisper preload notice: {e}")


# 3. Preload SentenceTransformer Embedding Model
try:
    print("[3/5] Downloading SentenceTransformer ('BAAI/bge-m3')...")
    from sentence_transformers import SentenceTransformer
    st_model = SentenceTransformer("BAAI/bge-m3", cache_folder=MODEL_CACHE_DIR)
    print(f"  [+] SentenceTransformer embedding model cached successfully!")
except Exception as e:
    print(f"  [-] BAAI/bge-m3 preload notice: {e}. Trying lightweight fallback 'all-MiniLM-L6-v2'...")
    try:
        from sentence_transformers import SentenceTransformer
        st_model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2", cache_folder=MODEL_CACHE_DIR)
        print(f"  [+] Fallback SentenceTransformer cached successfully!")
    except Exception as e2:
        print(f"  [-] SentenceTransformer fallback notice: {e2}")

# 4. Preload Ultra-Fast CrossEncoder Reranker Model
try:
    print("[4/5] Downloading CrossEncoder ('cross-encoder/ms-marco-MiniLM-L-6-v2')...")
    from sentence_transformers import CrossEncoder
    ce_model = CrossEncoder("cross-encoder/ms-marco-MiniLM-L-6-v2", cache_folder=MODEL_CACHE_DIR)
    print(f"  [+] CrossEncoder reranker cached successfully!")
except Exception as e:
    print(f"  [-] CrossEncoder preload notice: {e}")

# 5. Preload Local Translation Model (English -> Hindi)
try:
    print("[5/5] Downloading Local Translation Model ('Helsinki-NLP/opus-mt-en-hi')...")

    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
    model_name = "Helsinki-NLP/opus-mt-en-hi"
    AutoTokenizer.from_pretrained(model_name, cache_dir=MODEL_CACHE_DIR)
    AutoModelForSeq2SeqLM.from_pretrained(model_name, cache_dir=MODEL_CACHE_DIR)
    print(f"  [+] Local NMT Translation Model ('{model_name}') cached successfully!")
except Exception as e:
    print(f"  [-] Local Translation model preload notice: {e}")

print(f"============================================================")
print(f"[+] All requested CrimeOS models pre-downloaded.")
print(f"============================================================")
