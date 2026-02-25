const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const SUPABASE_URL = 'https://kxgrwkzxskdfdsnlxofs.supabase.co';
const ANON_KEY = 'sb_publishable_ZPg7FCCBrBZL1_6E0-98SQ_nbmsP5x2';
const JWT_SECRET = 'c+hxaCbDPaDEw3Qw1m4BiFu6aajTR7lw3LfpruNdmXKKry5mXMbv2zpTJj+xj0Ehqh7RIacTDhKXRxnOYtevIQ==';
const PHONE = '+918767689904'; // Atharv's phone from DB

async function verify() {
    console.log('--- Verifying Website Connection ---');

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

    console.log('\n1. Fetching Profile (User Auth)...');
    const { data: profile, error: pErr } = await supabase.from('profiles').select('*').single();
    if (pErr) {
        console.error('Fetch Error:', pErr.message);
    } else {
        console.log('Success! Found profile:', profile.display_name);
    }

    console.log('\n2. Fetching Subjects (User Auth - RLS)...');
    const { data: subjects, error: sErr } = await supabase.from('subjects').select('*');
    if (sErr) {
        console.error('Fetch Error:', sErr.message);
    } else {
        console.log('Success! Found subjects:', subjects.length);
        subjects.forEach(s => console.log(` - ${s.name}`));
    }

    console.log('\n3. Testing Write (Attendance Log)...');
    const testSubject = subjects && subjects.length > 0 ? subjects[0].id : null;
    if (testSubject) {
        const { data: log, error: lErr } = await supabase.from('attendance_logs').insert([{
            profile_id: profile.id,
            subject_id: testSubject,
            status: 'present',
            lecture_date: new Date().toISOString().split('T')[0]
        }]).select();

        if (lErr) {
            console.error('Write Error:', lErr.message);
        } else {
            console.log('Write Success! Log ID:', log[0].id);

            // Cleanup
            await supabase.from('attendance_logs').delete().eq('id', log[0].id);
            console.log('Cleanup Successful.');
        }
    } else {
        console.log('Skipping write test: No subjects found.');
    }

    console.log('\n--- Verification Complete ---');
}

verify();
