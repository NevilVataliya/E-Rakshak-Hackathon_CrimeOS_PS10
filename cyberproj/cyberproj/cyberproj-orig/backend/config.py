import os
import json
from pydantic import BaseModel, Field
from typing import Optional

CONFIG_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "config.json")

class OfficerProfile(BaseModel):
    name: str = ""
    rank: str = ""
    badge_number: str = ""
    department: str = ""
    contact_number: str = ""
    email: str = ""
    signature: str = ""

class SmtpConfig(BaseModel):
    host: str = ""
    port: int = 587
    user: str = ""
    password: str = ""
    sender_name: str = ""

class AppSettings(BaseModel):
    gemini_api_key: str = ""
    officer: OfficerProfile = Field(default_factory=OfficerProfile)
    smtp: SmtpConfig = Field(default_factory=SmtpConfig)

def load_settings() -> AppSettings:
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                data = json.load(f)
                return AppSettings(**data)
        except Exception as e:
            print(f"Error reading config: {e}")
    # Try reading from environment variable if config file is not set
    api_key = os.environ.get("GEMINI_API_KEY", "") or os.environ.get("GOOGLE_API_KEY", "")
    return AppSettings(gemini_api_key=api_key)

def save_settings(settings: AppSettings):
    try:
        with open(CONFIG_FILE, "w") as f:
            json.dump(settings.dict(), f, indent=2)
        # Also set the environment variable locally
        if settings.gemini_api_key:
            os.environ["GEMINI_API_KEY"] = settings.gemini_api_key
    except Exception as e:
        print(f"Error saving config: {e}")
