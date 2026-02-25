const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4Z3J3a3p4c2tkZmRzbmx4b2ZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTI0NDIzMCwiZXhwIjoyMDg2ODIwMjMwfQ.R1ifDdarj7eMm9ToR25SlQ49L4w0JxB3YlnO0DVEwFg';

async function applyFix() {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const policies = [
        { table: 'subject_categories', name: 'Users can insert own categories' },
        { table: 'subjects', name: 'Users can insert own subjects' },
        { table: 'attendance_logs', name: 'Users can insert own attendance' },
        { table: 'grades', name: 'Users can insert own grades' },
        { table: 'study_timers', name: 'Users can insert own timers' },
        { table: 'tasks', name: 'Users can insert own tasks' }
    ];

    console.log('--- Applying RLS INSERT Policies ---');

    for (const p of policies) {
        console.log(`Applying to ${p.table}...`);
        const sql = `
      DO $$ 
      BEGIN 
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies 
          WHERE tablename = '${p.table}' AND policyname = '${p.name}'
        ) THEN
          CREATE POLICY "${p.name}" ON "${p.table}" FOR INSERT TO public WITH CHECK ((profile_id = get_profile_id_from_jwt()));
        END IF;
      END $$;
    `;

        // Using RPC to execute SQL if possible, otherwise we update the file and tell user.
        // In many Supabase setups, you can't run arbitrary SQL via the client easily.
        // However, we can try to use a function if one exists to exec sql, but usually not.
        console.log(`SQL: ${sql.trim()}`);
    }

    console.log('\n--- IMPORTANT ---');
    console.log('Please run the above SQL in your Supabase SQL Editor to enable write access.');
    console.log('I will now update the master schema file as well.');
}

applyFix();
