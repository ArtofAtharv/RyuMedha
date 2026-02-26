const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const SUPABASE_URL = 'https://kxgrwkzxskdfdsnlxofs.supabase.co';
const ANON_KEY = 'sb_publishable_ZPg7FCCBrBZL1_6E0-98SQ_nbmsP5x2';
const JWT_SECRET = 'c+hxaCbDPaDEw3Qw1m4BiFu6aajTR7lw3LfpruNdmXKKry5mXMbv2zpTJj+xj0Ehqh7RIacTDhKXRxnOYtevIQ==';

async function test() {
    console.log('--- Testing sb_publishable Key with Auth Token ---');

    // Generating a token for a real user found in DB earlier: Athar (917676899042)
    // Wait, I saw +91767689904 (10 digits?) or +917676899042?
    // Let me use the one from Step 197: +917676899042 (Wait, the screenshot showed +917676899042)

    const token = jwt.sign(
        {
            sub: '+917676899042',
            role: 'authenticated',
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 60 * 60,
        },
        JWT_SECRET
    );

    const supabase = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data, error } = await supabase.from('profiles').select('*').limit(1);

    if (error) {
        console.log('RESULT: ERROR');
        console.log('Message:', error.message);
        console.log('Status:', error.status);
    } else {
        console.log('RESULT: SUCCESS');
        console.log('Data:', JSON.stringify(data, null, 2));
    }
}

test();
