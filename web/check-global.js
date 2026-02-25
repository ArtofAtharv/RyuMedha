const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4Z3J3a3p4c2tkZmRzbmx4b2ZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTI0NDIzMCwiZXhwIjoyMDg2ODIwMjMwfQ.R1ifDdarj7eMm9ToR25SlQ49L4w0JxB3YlnO0DVEwFg';

async function checkGlobal() {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    console.log('--- Global DB Status ---');

    const { data: profs } = await supabase.from('profiles').select('*');
    console.log('Total Profiles:', profs?.length || 0);
    profs?.forEach(p => {
        console.log(` - ${p.display_name} (${p.whatsapp_number})`);
        console.log(`   ID: ${p.id}`);
        console.log(`   Current Semester ID: ${p.current_semester_id}`);
        console.log(`   Academics Enabled: ${p.academics_enabled}`);
    });

    const { data: subs } = await supabase.from('subjects').select('*, source_course_id(*)');
    console.log('\nTotal Subjects:', subs?.length || 0);
    subs?.forEach(s => {
        const course = s.source_course_id;
        console.log(` - ${s.name} (Type: ${s.type})`);
        console.log(`   Subject Profile ID: ${s.profile_id}`);
        if (course) {
            console.log(`   Course Semester ID: ${course.semester_id}`);
        }
    });

    const { data: sems } = await supabase.from('semesters').select('*');
    console.log('\nSemesters in DB:', sems?.length || 0);
    sems?.forEach(s => console.log(` - ${s.name} (ID: ${s.id})`));

    console.log('\n--- Status Complete ---');
}

checkGlobal();
