const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const SUPABASE_URL = 'https://kxgrwkzxskdfdsnlxofs.supabase.co';
const ANON_KEY = 'sb_publishable_ZPg7FCCBrBZL1_6E0-98SQ_nbmsP5x2';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4Z3J3a3p4c2tkZmRzbmx4b2ZzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTI0NDIzMCwiZXhwIjoyMDg2ODIwMjMwfQ.R1ifDdarj7eMm9ToR25SlQ49L4w0JxB3YlnO0DVEwFg';
const JWT_SECRET = 'c+hxaCbDPaDEw3Qw1m4BiFu6aajTR7lw3LfpruNdmXKKry5mXMbv2zpTJj+xj0Ehqh7RIacTDhKXRxnOYtevIQ==';

async function test() {
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: profiles } = await supabaseAdmin.from('profiles').select('whatsapp_number').limit(5);

    if (!profiles || profiles.length === 0) {
        console.log('No profiles found even with admin key!');
        return;
    }

    const phone = profiles[0].whatsapp_number;
    console.log(`Testing RLS with phone: ${phone}`);

    const token = jwt.sign(
        {
            sub: phone,
            role: 'authenticated',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 60 * 60,
        },
        JWT_SECRET
    );

    const supabaseUser = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data, error } = await supabaseUser.from('profiles').select('*');

    if (error) {
        console.log('User Fetch Error:', error.message);
    } else {
        console.log('User Fetch Success:', JSON.stringify(data, null, 2));
    }
}

test();
