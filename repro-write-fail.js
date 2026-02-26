const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const SUPABASE_URL = 'https://kxgrwkzxskdfdsnlxofs.supabase.co';
// Using the VALID anon key from debug-connection.js
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4Z3J3a3p4c2tkZmRzbmx4b2ZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyNDQyMzAsImV4cCI6MjA4NjgyMDIzMH0.N9uE_pD0f8v1eIPxukGlIQJhTJk';
const JWT_SECRET = 'c+hxaCbDPaDEw3Qw1m4BiFu6aajTR7lw3LfpruNdmXKKry5mXMbv2zpTJj+xj0Ehqh7RIacTDhKXRxnOYtevIQ==';
const PHONE = '+918767689904';

async function reproduce() {
    console.log('--- Reproducing Write Failure ---');

    const token = jwt.sign(
        {
            sub: PHONE,
            role: 'authenticated',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 60 * 60,
        },
        JWT_SECRET
    );

    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } }
    });

    // 1. Get Profile ID
    const { data: profile } = await supabase.from('profiles').select('id').single();
    if (!profile) {
        console.error('Could not find profile. RLS SELECT might be failing.');
        return;
    }
    console.log('Using Profile ID:', profile.id);

    // 2. Try to insert a subject (since we need one for attendance log)
    console.log('\nTesting Subject Insertion...');
    const { data: subject, error: sErr } = await supabase.from('subjects').insert([{
        profile_id: profile.id,
        name: 'Test Subject ' + Date.now(),
        type: 'personal',
        color_hex: '#8b5cf6'
    }]).select().single();

    if (sErr) {
        console.error('Subject Insert Error:', sErr.message);
    } else {
        console.log('Subject Insert Success! ID:', subject.id);

        // 3. Try to insert attendance log
        console.log('\nTesting Attendance Log Insertion...');
        const { data: log, error: lErr } = await supabase.from('attendance_logs').insert([{
            profile_id: profile.id,
            subject_id: subject.id,
            status: 'present',
            lecture_date: new Date().toISOString().split('T')[0]
        }]).select();

        if (lErr) {
            console.error('Attendance Log Insert Error:', lErr.message);
        } else {
            console.log('Attendance Log Insert Success! ID:', log[0].id);
            // Cleanup
            await supabase.from('attendance_logs').delete().eq('id', log[0].id);
            console.log('Log Cleanup Successful.');
        }

        // Cleanup subject
        await supabase.from('subjects').delete().eq('id', subject.id);
        console.log('Subject Cleanup Successful.');
    }
}

reproduce();
