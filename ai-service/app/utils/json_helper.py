import json
import re
from typing import Optional, Type, Dict, Any
from pydantic import BaseModel

try:
    from json_repair import repair_json
except ImportError:
    repair_json = None

def parse_llm_json(response_text: str, schema_model: Optional[Type[BaseModel]] = None, default_fallback: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Bulletproof Multi-Layer LLM JSON Extractor & Pydantic Validator.
    1. Uses json_repair to handle trailing commas, unescaped quotes, single quotes, and truncated braces.
    2. Uses Regex matching for enclosed {...} or [...] blocks.
    3. Validates against Pydantic schema and populates missing fields with default values.
    """
    if not response_text or not isinstance(response_text, str):
        if schema_model:
            return schema_model().model_dump()
        return default_fallback or {}

    parsed_obj = None

    # Step 1: Use json_repair (if available)
    if repair_json is not None:
        try:
            repaired = repair_json(response_text, return_objects=True)
            if isinstance(repaired, (dict, list)):
                parsed_obj = repaired
        except Exception:
            pass

    # Step 2: Regex extraction for {...} block
    if parsed_obj is None:
        match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if match:
            try:
                if repair_json is not None:
                    parsed_obj = repair_json(match.group(0), return_objects=True)
                else:
                    parsed_obj = json.loads(match.group(0))
            except Exception:
                pass

    # Step 3: Standard json.loads on cleaned markdown
    if parsed_obj is None:
        try:
            clean_text = response_text.replace("```json", "").replace("```", "").strip()
            parsed_obj = json.loads(clean_text)
        except Exception:
            pass

    # Step 4: Validate against Pydantic Schema Model
    if parsed_obj and isinstance(parsed_obj, dict) and schema_model:
        try:
            validated_model = schema_model.model_validate(parsed_obj)
            return validated_model.model_dump()
        except Exception as ve:
            print(f"[!] Pydantic Validation Warning: {ve}. Merging defaults.")
            default_dict = schema_model().model_dump()
            default_dict.update({k: v for k, v in parsed_obj.items() if k in default_dict})
            return default_dict

    if parsed_obj and isinstance(parsed_obj, dict):
        return parsed_obj

    # Fallback to schema default or explicit fallback
    if schema_model:
        return schema_model().model_dump()
    return default_fallback or {}
