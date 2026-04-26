import re

p = 'supabase/functions/send-reminders/index.ts'
with open(p, 'r', encoding='utf-8') as f:
    code = f.read()

# Target block for the WhatsApp fetch response
target = r"""          if \(res\.ok\) \{
            whatsAppSuccess = true
          \} else \{
            console\.error\("WhatsApp error for reminder", reminder\.id, await res\.text\(\)\)
          \}"""

# Replacement block that includes logging the message ID
replacement = """          if (res.ok) {
            const waData = await res.json()
            const waMessageId = waData.messages?.[0]?.id
            if (waMessageId) {
              await supabase.from('whatsapp_message_logs').insert({
                profile_id: reminder.profile_id,
                wa_message_id: waMessageId,
                status: 'sent',
                body: msg,
                message_type: 'reminder'
              })
            }
            whatsAppSuccess = true
          } else {
            console.error("WhatsApp error for reminder", reminder.id, await res.text())
          }"""

new_code = re.sub(target, replacement, code)

with open(p, 'w', encoding='utf-8') as f:
    f.write(new_code)
print("Edge Function Patched with WhatsApp logging!")
