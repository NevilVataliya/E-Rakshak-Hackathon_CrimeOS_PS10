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
USE_OLLAMA = os.getenv("USE_OLLAMA", "true").lower() in ("true", "1", "yes")
OFFLINE_MODE = os.getenv("OFFLINE_MODE", "auto").lower()

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3:latest")

def is_offline_mode() -> bool:
    """
    Returns True if system is explicitly configured for offline execution
    or if no cloud LLM API keys are configured in auto mode.
    When USE_OLLAMA is active, local Ollama is treated as sovereign offline AI engine.
    """
    if OFFLINE_MODE in ("true", "1", "yes"):
        return True
    if OFFLINE_MODE in ("false", "0", "no"):
        return False
    # Auto mode: offline if no cloud API keys exist
    has_cloud_keys = bool(GEMINI_API_KEY or OPENAI_API_KEY or GROQ_API_KEY or ANTHROPIC_API_KEY)
    return not has_cloud_keys

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

print(f"[*] Configuration Loaded: DEBUG={DEBUG} | USE_OLLAMA={USE_OLLAMA} | OLLAMA_URL={OLLAMA_BASE_URL} | MODEL_CACHE={MODEL_CACHE_DIR}")

class LocalOllamaChat:
    """
    High-performance LangChain-compatible Chat Model for local Ollama instances.
    Provides standard .invoke(prompt) returning response object with .content string.
    """
    def __init__(self, model: str = None, base_url: str = None, temperature: float = 0.2):
        self.model = model or OLLAMA_MODEL
        self.base_url = (base_url or OLLAMA_BASE_URL).rstrip('/')
        self.temperature = temperature

    def invoke(self, prompt_or_messages, **kwargs):
        import requests
        prompt_str = ""
        if isinstance(prompt_or_messages, str):
            prompt_str = prompt_or_messages
        elif isinstance(prompt_or_messages, list):
            parts = []
            for m in prompt_or_messages:
                content = getattr(m, 'content', str(m))
                parts.append(str(content))
            prompt_str = "\n\n".join(parts)
        else:
            prompt_str = str(prompt_or_messages)

        # 1. Try standard /api/chat endpoint
        try:
            url = f"{self.base_url}/api/chat"
            payload = {
                "model": self.model,
                "messages": [{"role": "user", "content": prompt_str}],
                "stream": False,
                "options": {"temperature": self.temperature}
            }
            res = requests.post(url, json=payload, timeout=90)
            if res.status_code == 200:
                data = res.json()
                msg_content = data.get("message", {}).get("content", "")
                return type("OllamaResponse", (), {"content": msg_content})()
        except Exception:
            pass

        # 2. Try /api/generate endpoint
        try:
            url = f"{self.base_url}/api/generate"
            payload = {
                "model": self.model,
                "prompt": prompt_str,
                "stream": False,
                "options": {"temperature": self.temperature}
            }
            res = requests.post(url, json=payload, timeout=90)
            if res.status_code == 200:
                data = res.json()
                gen_content = data.get("response", "")
                return type("OllamaResponse", (), {"content": gen_content})()
        except Exception as e:
            raise RuntimeError(f"Ollama execution error on {self.base_url}: {e}")

        raise RuntimeError(f"Could not connect to Ollama at {self.base_url} (Model: {self.model})")

def get_ollama_llm(temperature: float = 0.2):
    """
    Returns an initialized Ollama Chat LLM instance.
    """
    try:
        from langchain_community.chat_models import ChatOllama
        return ChatOllama(
            base_url=OLLAMA_BASE_URL,
            model=OLLAMA_MODEL,
            temperature=temperature
        )
    except Exception:
        return LocalOllamaChat(
            base_url=OLLAMA_BASE_URL,
            model=OLLAMA_MODEL,
            temperature=temperature
        )

def get_vision_llm():
    """
    Returns Gemini Flash model for multimodal ingestion when online,
    or falls back to local vision/OCR processors.
    """
    if GEMINI_API_KEY:
        return ChatGoogleGenerativeAI(
            model="gemini-2.0-flash",
            google_api_key=GEMINI_API_KEY,
            temperature=0.1
        )
    elif OPENAI_API_KEY:
        return ChatOpenAI(model="gpt-4o-mini", api_key=OPENAI_API_KEY, temperature=0.1)
    elif USE_OLLAMA:
        return get_ollama_llm(temperature=0.1)
    else:
        if not ENABLE_DEMO_FALLBACKS:
            raise ValueError("No Vision LLM API Key configured (GEMINI_API_KEY or OPENAI_API_KEY required).")
        return None

def get_agent_llm(provider: str = "auto", temperature: float = 0.2):
    """
    Polyglot LLM Factory getter.
    Prioritizes explicit provider, LLM_PROVIDER env var, auto-selection, or local Ollama.
    """
    env_provider = os.getenv("LLM_PROVIDER", "auto").lower()
    target_provider = provider.lower() if provider != "auto" else env_provider

    if target_provider == "ollama" or (target_provider == "auto" and USE_OLLAMA and not (GEMINI_API_KEY or GROQ_API_KEY or OPENAI_API_KEY or ANTHROPIC_API_KEY)):
        return get_ollama_llm(temperature=temperature)

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
    elif USE_OLLAMA:
        return get_ollama_llm(temperature=temperature)
    else:
        if not ENABLE_DEMO_FALLBACKS:
            raise ValueError("No Agent LLM API Keys found in .env (GROQ_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, or USE_OLLAMA=true required).")
        return None



