require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function listUsers() {
    console.log('Fetching users...');
    const { data, error } = await supabase
        .from('profiles')
        .select('id, whatsapp_number, display_name');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('\n--- REGISTERED USERS ---');
    if (data.length === 0) {
        console.log('No users found.');
    } else {
        data.forEach(u => {
            console.log(`[${u.id}] ${u.whatsapp_number} (${u.display_name})`);
        });
    }
    console.log('------------------------\n');
}

listUsers();
