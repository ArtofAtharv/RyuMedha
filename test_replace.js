const fs = require('fs');
const p = 'web/app/dashboard/tasks/page.tsx';
let code = fs.readFileSync(p, 'utf8');

const stateTarget = `  const [title, setTitle] = useState("")
  const [priority, setPriority] = useState("medium")
  const [dueDate, setDueDate] = useState("")
  const [subjectId, setSubjectId] = useState("none")
  const [hasReminder, setHasReminder] = useState(false)
  const [reminderTime, setReminderTime] = useState("09:00")`;

if (!code.includes(stateTarget)) {
  console.log("Not found in file!");
} else {
  console.log("Found!");
}
