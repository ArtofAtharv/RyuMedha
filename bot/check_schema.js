const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
    const { data, error } = await supabase.from('message_queue').select('*').limit(1);
    console.log('message_queue Data:', data);
    console.log('message_queue Error:', error);
}

checkSchema();
