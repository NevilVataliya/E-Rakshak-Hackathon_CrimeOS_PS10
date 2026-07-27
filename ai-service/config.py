import os
from pathlib import Path
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq

# Load root .env file and local .env file
root_env_path = Path(__file__).resolve().parent.parent / '.env'
if root_env_path.exists():
    load_dotenv(dotenv_path=root_env_path)
load_dotenv()

# Central Debugging & Fallback Control Flags
ENABLE_DEMO_FALLBACKS = os.getenv("ENABLE_DEMO_FALLBACKS", "false").lower() == "true"
DEBUG = os.getenv("DEBUG", "true").lower() == "true"

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
COLLECTION_NAME = os.getenv("COLLECTION_NAME", "police_sops_v3")

# --- RAG PIPELINE TUNING PARAMETERS ---
RAG_ENABLE_HYDE = os.getenv("RAG_ENABLE_HYDE", "true").lower() == "true"
RAG_ENABLE_MULTI_QUERY = os.getenv("RAG_ENABLE_MULTI_QUERY", "true").lower() == "true"
RAG_MAX_SUB_QUERIES = int(os.getenv("RAG_MAX_SUB_QUERIES", "4"))
RAG_CANDIDATES_PER_QUERY = int(os.getenv("RAG_CANDIDATES_PER_QUERY", "50"))
RAG_RERANKER_MODEL = os.getenv("RAG_RERANKER_MODEL", "BAAI/bge-reranker-base")
RAG_RERANKER_TOP_K = int(os.getenv("RAG_RERANKER_TOP_K", "15"))

print(f"[*] Configuration Loaded: DEBUG={DEBUG} | ENABLE_DEMO_FALLBACKS={ENABLE_DEMO_FALLBACKS} | MODEL_CACHE={MODEL_CACHE_DIR}")
print(f"[*] RAG Config: HYDE={RAG_ENABLE_HYDE} | MULTI_QUERY={RAG_ENABLE_MULTI_QUERY} | MAX_QUERIES={RAG_MAX_SUB_QUERIES} | RERANKER={RAG_RERANKER_MODEL}")

def get_vision_llm():
    """
    Returns Gemini Flash model for high-accuracy multimodal (Image OCR, Handwriting, Audio) ingestion.
    """
    if GEMINI_API_KEY:
        return ChatGoogleGenerativeAI(
            model="gemini-1.5-flash",
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
    Prioritizes Groq / Claude / OpenAI for strict JSON schema compliance & zero hallucinations.
    Falls back gracefully if specific keys are absent.
    """
    if provider == "groq" and GROQ_API_KEY:
        return ChatGroq(model_name="llama-3.1-8b-instant", groq_api_key=GROQ_API_KEY, temperature=temperature)

    if provider == "claude" and ANTHROPIC_API_KEY:
        return ChatAnthropic(model="claude-3-5-sonnet-20240620", api_key=ANTHROPIC_API_KEY, temperature=temperature)

    if provider == "openai" and OPENAI_API_KEY:
        return ChatOpenAI(model="gpt-4o", api_key=OPENAI_API_KEY, temperature=temperature)

    if provider == "gemini" and GEMINI_API_KEY:
        return ChatGoogleGenerativeAI(model="gemini-1.5-pro", google_api_key=GEMINI_API_KEY, temperature=temperature)

    # AUTO SELECTION
    if GROQ_API_KEY:
        return ChatGroq(model_name="llama-3.1-8b-instant", groq_api_key=GROQ_API_KEY, temperature=temperature)
    elif ANTHROPIC_API_KEY:
        return ChatAnthropic(model="claude-3-5-sonnet-20240620", api_key=ANTHROPIC_API_KEY, temperature=temperature)
    elif OPENAI_API_KEY:
        return ChatOpenAI(model="gpt-4o-mini", api_key=OPENAI_API_KEY, temperature=temperature)
    elif GEMINI_API_KEY:
        return ChatGoogleGenerativeAI(model="gemini-1.5-flash", google_api_key=GEMINI_API_KEY, temperature=temperature)
    else:
        if not ENABLE_DEMO_FALLBACKS:
            raise ValueError("No Agent LLM API Keys found in .env (GROQ_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, or GEMINI_API_KEY required).")
        return ChatOpenAI(model="gpt-4o-mini", api_key="mock", temperature=temperature)
