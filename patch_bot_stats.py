import sys

path = 'supabase/functions/whatsapp-bot/processor.ts'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

old_str = "let msg = prefix + MESSAGES.attendance.summaryLine(emoji, subject.name, present, total, pct.toFixed(1));"
new_str = "let msg = prefix + MESSAGES.attendance.summaryLine(emoji, subject.name, present + deemed, total, pct.toFixed(1));"

if old_str in content:
    content = content.replace(old_str, new_str)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Successfully patched processor.ts!")
else:
    print("Could not find the target string in processor.ts. It may have already been patched.")
