import sys
import json
import time
sys.stdout.reconfigure(encoding='utf-8')

from app.services.offline_translator import offline_translator

samples = [
    "Investigation Command Register",
    "Active Cases",
    "Subpoenas Dispatched",
    "Serial Link Matches",
    "Complaint Intake & Multimodal Parsing",
    "Official law enforcement pipeline — manage FIR cases, serial offender linkage, and legal requisitions."
]

t0 = time.time()
hi_res = offline_translator.translate_batch(samples, "hi")
print(f"Hindi ({time.time()-t0:.2f}s):", hi_res)

t0 = time.time()
gu_res = offline_translator.translate_batch(samples, "gu")
print(f"Gujarati ({time.time()-t0:.2f}s):", gu_res)
