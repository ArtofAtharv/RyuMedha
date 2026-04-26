import re

with open('web/app/dashboard/tasks/page.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Fix 1: select('id') -> select('id, push_notifications_enabled')
code = code.replace(".select('id')", ".select('id, push_notifications_enabled')")

# Fix 2: Remove editHasReminder props
code = re.sub(
    r'editHasReminder=\{editHasReminder\}\s*setEditHasReminder=\{setEditHasReminder\}\s*editReminderTime=\{editReminderTime\}\s*setEditReminderTime=\{setEditReminderTime\}',
    '',
    code
)

with open('web/app/dashboard/tasks/page.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("PYTHON_PATCH_2_DONE")
