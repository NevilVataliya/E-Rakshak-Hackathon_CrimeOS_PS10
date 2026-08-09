import os
from pathlib import Path
from dotenv import load_dotenv
try:
    from langchain_openai import ChatOpenAI
except ImportError:
    ChatOpenAI = None

try:
    from langchain_anthropic import ChatAnthropic
except ImportError:
    ChatAnthropic = None

try:
    from langchain_google_genai import ChatGoogleGenerativeAI
except ImportError:
    ChatGoogleGenerativeAI = None

try:
    from langchain_groq import ChatGroq
except ImportError:
    ChatGroq = None

# Load centralized error-handling policy (fallback/abort + retry config)
from app.utils.error_policy import (
    ERROR_POLICY,
    MAX_RETRIES,
    RETRY_BASE_DELAY,
    RETRY_MAX_DELAY,
    RETRY_BACKOFF_FACTOR,
    MAX_RETRY_WAIT_SEC,
    get_policy_summary,
)



# Load root .env file and local .env file
root_env_path = Path(__file__).resolve().parent.parent / '.env'
if root_env_path.exists():
    load_dotenv(dotenv_path=root_env_path)
load_dotenv()

# Central Debugging & Fallback Control Flags
ENABLE_DEMO_FALLBACKS = os.getenv("ENABLE_DEMO_FALLBACKS", "false").lower() == "true"
DEBUG = os.getenv("DEBUG", "true").lower() == "true"
USE_OLLAMA = os.getenv("USE_OLLAMA", "false").lower() == "true"
OFFLINE_MODE = os.getenv("OFFLINE_MODE", "auto").lower()

def is_offline_mode() -> bool:
    """
    Returns True if system is explicitly configured for offline execution
    or if no cloud LLM API keys are configured in auto mode.
    """
    if OFFLINE_MODE in ("true", "1", "yes"):
        return True
    if OFFLINE_MODE in ("false", "0", "no"):
        return False
    # Auto mode: offline if no cloud API keys exist
    has_keys = bool(GEMINI_API_KEY or OPENAI_API_KEY or GROQ_API_KEY or ANTHROPIC_API_KEY)
    return not has_keys

# Persistent Model Cache Directory Configuration
MODEL_CACHE_DIR = os.getenv("MODEL_CACHE_DIR", str(Path(__file__).resolve().parent / "models_cache"))
os.makedirs(MODEL_CACHE_DIR, exist_ok=True)
os.environ["HF_HOME"] = os.getenv("HF_HOME", MODEL_CACHE_DIR)
os.environ["SENTENCE_TRANSFORMERS_HOME"] = os.getenv("SENTENCE_TRANSFORMERS_HOME", MODEL_CACHE_DIR)

# HuggingFace & Tokenizer Environment Settings
HF_TOKEN = os.getenv("HF_TOKEN", "")
if HF_TOKEN:
    os.environ["HF_TOKEN"] = HF_TOKEN

os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

# Environment settings
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", 6333))
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://crimeos_user:crimeos_password@localhost:5432/crimeos_db")
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "police_sops_v2")

print(f"[*] Configuration Loaded: DEBUG={DEBUG} | ENABLE_DEMO_FALLBACKS={ENABLE_DEMO_FALLBACKS} | MODEL_CACHE={MODEL_CACHE_DIR}")

def get_vision_llm():
    """
    Returns Gemini Flash model for high-accuracy multimodal (Image OCR, Handwriting, Audio) ingestion.
    """
    if GEMINI_API_KEY:
        return ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            google_api_key=GEMINI_API_KEY,
            temperature=0.1
        )
    elif OPENAI_API_KEY:
        return ChatOpenAI(model="gpt-4o-mini", api_key=OPENAI_API_KEY, temperature=0.1)
    else:
        if not ENABLE_DEMO_FALLBACKS:
            raise ValueError("No Vision LLM API Key configured (GEMINI_API_KEY or OPENAI_API_KEY required).")
        return None

def get_agent_llm(provider: str = "auto", temperature: float = 0.2):
    """
    Polyglot LLM Factory getter.
    Prioritizes explicit provider, LLM_PROVIDER env var, or auto-selection.
    """
    env_provider = os.getenv("LLM_PROVIDER", "auto").lower()
    target_provider = provider.lower() if provider != "auto" else env_provider

    if target_provider == "gemini" and GEMINI_API_KEY:
        return ChatGoogleGenerativeAI(model="gemini-2.0-flash", google_api_key=GEMINI_API_KEY, temperature=temperature)

    if target_provider == "groq" and GROQ_API_KEY:
        return ChatGroq(model_name="llama-3.3-70b-versatile", groq_api_key=GROQ_API_KEY, temperature=temperature)

    if target_provider == "claude" and ANTHROPIC_API_KEY:
        return ChatAnthropic(model="claude-3-5-sonnet-20240620", api_key=ANTHROPIC_API_KEY, temperature=temperature)

    if target_provider == "openai" and OPENAI_API_KEY:
        return ChatOpenAI(model="gpt-4o", api_key=OPENAI_API_KEY, temperature=temperature)

    # AUTO SELECTION
    if GEMINI_API_KEY and (env_provider == "gemini" or not GROQ_API_KEY):
        return ChatGoogleGenerativeAI(model="gemini-2.0-flash", google_api_key=GEMINI_API_KEY, temperature=temperature)
    elif GROQ_API_KEY:
        try:
            return ChatGroq(model_name="llama-3.3-70b-versatile", groq_api_key=GROQ_API_KEY, temperature=temperature)
        except Exception:
            if GEMINI_API_KEY:
                return ChatGoogleGenerativeAI(model="gemini-2.0-flash", google_api_key=GEMINI_API_KEY, temperature=temperature)
            return ChatGroq(model_name="llama3-70b-8192", groq_api_key=GROQ_API_KEY, temperature=temperature)
    elif ANTHROPIC_API_KEY:
        return ChatAnthropic(model="claude-3-5-sonnet-20240620", api_key=ANTHROPIC_API_KEY, temperature=temperature)
    elif OPENAI_API_KEY:
        return ChatOpenAI(model="gpt-4o-mini", api_key=OPENAI_API_KEY, temperature=temperature)
    elif GEMINI_API_KEY:
        return ChatGoogleGenerativeAI(model="gemini-2.0-flash", google_api_key=GEMINI_API_KEY, temperature=temperature)
    else:
        if not ENABLE_DEMO_FALLBACKS:
            raise ValueError("No Agent LLM API Keys found in .env (GROQ_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY required).")
        return None



