"""Quick diagnostic: list available models and test a minimal call."""
import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

from google import genai

api_key = os.getenv("GEMINI_API_KEY")
print(f"API Key (first 10 chars): {api_key[:10]}...")

client = genai.Client(api_key=api_key)

# List available models
print("\n--- Available Models ---")
try:
    for model in client.models.list():
        if "flash" in model.name.lower() or "gemini" in model.name.lower():
            print(f"  {model.name}")
except Exception as e:
    print(f"  Error listing models: {e}")

# Try a minimal call with gemini-2.0-flash
print("\n--- Testing minimal call ---")
for model_name in ['gemini-2.0-flash', 'gemini-2.0-flash-lite']:
    try:
        response = client.models.generate_content(
            model=model_name,
            contents="Say hello in one word."
        )
        print(f"  {model_name}: SUCCESS → {response.text.strip()}")
        break
    except Exception as e:
        err_msg = str(e)[:120]
        print(f"  {model_name}: FAILED → {err_msg}")
