const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
require('dotenv').config({ path: '.env' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const JWT_SECRET = 'c+hxaCbDPaDEw3Qw1m4BiFu6aajTR7lw3LfpruNdmXKKry5mXMbv2zpTJj+xj0Ehqh7RIacTDhKXRxnOYtevIQ==';

async function simulate() {
    console.log('--- Simulating Dashboard Fetch ---');
    console.log('URL:', SUPABASE_URL);
    console.log('Anon Key:', ANON_KEY);

    // Use a known phone number from the DB
    const phone = '+918767689904';
    console.log('Target Phone:', phone);

    const token = jwt.sign(
        {
            sub: phone,
            role: 'authenticated',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 60 * 60,
        },
        JWT_SECRET
    );

    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } }
    });

    console.log('\n1. Fetching Profile...');
    const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('whatsapp_number', phone)
        .single();

    if (profErr) {
        console.error('Profile Error:', profErr.message);
        return;
    }
    console.log('Profile found:', profile.display_name, '(ID:', profile.id, ')');

    console.log('\n2. Fetching Subjects...');
    const { data: subjects, error: subErr } = await supabase
        .from('subjects')
        .select('id, name, type, is_active, category_id, source_course_id(*)')
        .eq('is_active', true);

    if (subErr) {
        console.error('Subjects Error:', subErr.message);
    } else {
        console.log('Subjects found:', subjects.length);
        subjects.forEach(s => console.log(` - ${s.name} (${s.type})`));
    }

    console.log('\n3. Fetching Attendance Logs...');
    const { data: logs, error: logErr } = await supabase
        .from('attendance_logs')
        .select('*')
        .eq('profile_id', profile.id);

    if (logErr) {
        console.error('Logs Error:', logErr.message);
    } else {
        console.log('Logs found:', logs.length);
    }

    console.log('\n--- Simulation Complete ---');
}

simulate();
