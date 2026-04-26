const fs = require('fs');

const original = fs.readFileSync('web/app/dashboard/tasks/page.tsx', 'utf8');

// We will do exact substring replacements to guarantee correctness
let updated = original;

// 1. Add BellRing
updated = updated.replace(
  'import { CircleCheck, Clock, Trash2, Plus, Bell, Target, Calendar as CalIcon } from "lucide-react"',
  'import { CircleCheck, Clock, Trash2, Plus, Bell, BellRing, Target, Calendar as CalIcon } from "lucide-react"'
);

// 2. Main State
updated = updated.replace(
  'const [dueTime, setDueTime] = useState("09:00")\n  const [remindOnDue, setRemindOnDue] = useState(false)\n  const [remind1Day, setRemind1Day] = useState(false)\n  const [remindCustom, setRemindCustom] = useState(false)\n  const [customHours, setCustomHours] = useState(2)\n  const [pushEnabled, setPushEnabled] = useState(false)\n  const [isSubscribing, setIsSubscribing] = useState(false)',
  'const [dueTime, setDueTime] = useState("09:00")\n  const [remindOnDue, setRemindOnDue] = useState(false)\n  const [remind1Day, setRemind1Day] = useState(false)\n  const [remindCustom, setRemindCustom] = useState(false)\n  const [customHours, setCustomHours] = useState(2)\n  const [pushEnabled, setPushEnabled] = useState(false)\n  const [isSubscribing, setIsSubscribing] = useState(false)'
);
// wait, dueTime is already there. Let's make sure it's consistent.
// actually let's just do a clean fetch from git and then apply a robust patch.
