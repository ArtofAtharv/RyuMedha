const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const SUPABASE_URL = 'https://kxgrwkzxskdfdsnlxofs.supabase.co';
const ANON_KEY = 'sb_publishable_ZPg7FCCBrBZL1_6E0-98SQ_nbmsP5x2';
const JWT_SECRET = 'c+hxaCbDPaDEw3Qw1m4BiFu6aajTR7lw3LfpruNdmXKKry5mXMbv2zpTJj+xj0Ehqh7RIacTDhKXRxnOYtevIQ==';
const PHONE = '+918767689904';

async function verify() {
    const token = jwt.sign({ sub: PHONE, role: 'authenticated' }, JWT_SECRET);
    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: profile } = await supabase.from('profiles').select('display_name, current_semester_id, academics_enabled, personal_enabled').single();
    const { data: subjects } = await supabase.from('subjects').select('name, type, is_active, source_course_id(semester_id)');

    console.log('--- Profile ---');
    console.log(JSON.stringify(profile, null, 2));

    console.log('\n--- Subjects ---');
    subjects.forEach(s => {
        const semId = Array.isArray(s.source_course_id) ? s.source_course_id[0]?.semester_id : s.source_course_id?.semester_id;
        console.log(` - ${s.name} (Type: ${s.type}, Active: ${s.is_active}, Sem: ${semId})`);
        if (semId === profile.current_semester_id) {
            console.log('   MATCHES current semester');
        } else {
            console.log('   MISMATCH with current semester');
        }
    });
}

verify();
