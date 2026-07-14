import re
from pathlib import Path

def clean_html(html_content):
    # Remove script and style tags
    clean = re.sub(r'<(script|style).*?>.*?</\1>', '', html_content, flags=re.DOTALL | re.IGNORECASE)
    # Remove HTML tags
    clean = re.sub(r'<[^>]+>', ' ', clean)
    # Normalize whitespace
    clean = re.sub(r'\s+', ' ', clean)
    return clean

# Parse file
file_path = r"C:\Users\athar\.gemini\antigravity-ide\brain\b99c71af-287d-457d-9343-937467a5aa3f\.system_generated\steps\281\content.md"
content = Path(file_path).read_text(encoding='utf-8')
cleaned = clean_html(content)

# Look for sections containing app name or matching rules
print("=== CLEANED TEXT SUMMARY ===")
# Find sentences
sentences = re.split(r'(?<=[.!?]) +', cleaned)
for s in sentences:
    if any(keyword in s.lower() for keyword in ["app name", "consent", "match", "branding", "logo", "homepage", "purpose", "describe", "function"]):
        print("-", s.strip()[:200])
