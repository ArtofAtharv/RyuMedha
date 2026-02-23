/**
 * broadcast.js — Ryu Medha WhatsApp Broadcast Utility
 * 
 * Usage:
 *   node bot/broadcast.js "Your message here"
 *   node bot/broadcast.js --type online
 *   node bot/broadcast.js --type offline
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing environment variables. Check .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function sendMessage(to, body) {
    const url = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`;

    // WhatsApp API expects digits only for 'to', but our DB stores E.164 (+91...)
    const cleanTo = to.replace(/\D/g, '');

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: cleanTo,
                text: { body },
            }),
        });

        const data = await res.json();
        return { ok: res.ok, data };
    } catch (err) {
        return { ok: false, error: err.message };
    }
}

async function runBroadcast() {
    const args = process.argv.slice(2);
    let message = '';
    let testPhone = null;

    // Simple arg parser
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--type') {
            const type = args[i + 1];
            if (type === 'online') {
                message = '🚀 *Ryu Medha is back online!*\n\nYou can now resume tracking your studies, attendance, and tasks. Happy studying! 🎓';
            } else if (type === 'offline') {
                message = '⚠️ *Ryu Medha Maintenance*\n\nThe bot will be briefly offline for updates. We\'ll notify you once we\'re back! 🛠️';
            }
            i++;
        } else if (args[i] === '--test') {
            testPhone = args[i + 1];
            i++;
        } else if (!message && !args[i].startsWith('--')) {
            message = args[i];
        }
    }

    if (!message) {
        console.error('❌ Please provide a message or use --type online/offline');
        console.log('Usage:');
        console.log('  node bot/broadcast.js "Hello"');
        console.log('  node bot/broadcast.js --type online');
        console.log('  node bot/broadcast.js --test +919000000000 --type online');
        process.exit(1);
    }

    console.log('\n--- 📢 Ryu Medha Broadcast ---');
    console.log(`Message: "${message}"`);
    if (testPhone) console.log(`Target:  TEST MODE (${testPhone})`);
    console.log('------------------------------\n');
    console.log('💡 NOTE: WhatsApp only allows sending free-form messages to users who have messaged you in the last 24 hours.');
    console.log('   If they haven\'t, Meta might return 200 OK but delivery will fail.\n');

    let users = [];

    if (testPhone) {
        users = [{ whatsapp_number: testPhone, display_name: 'Test Recipient' }];
    } else {
        const { data: fetchedUsers, error } = await supabase
            .from('profiles')
            .select('whatsapp_number, display_name')
            .not('whatsapp_number', 'is', null);

        if (error) {
            console.error('❌ Error fetching users:', error);
            process.exit(1);
        }
        users = fetchedUsers;
    }

    if (!users || users.length === 0) {
        console.log('ℹ️ No users found.');
        process.exit(0);
    }

    console.log(`👥 Target: ${users.length} user(s). Starting...\n`);

    let successCount = 0;
    let failCount = 0;

    for (const user of users) {
        const cleanTo = user.whatsapp_number.replace(/\D/g, '');
        process.stdout.write(`📤 Sending to ${user.display_name} (${cleanTo})... `);

        const result = await sendMessage(user.whatsapp_number, message);

        if (result.ok) {
            console.log('✅');
            if (result.data?.messages?.[0]?.id) {
                console.log(`   Message ID: ${result.data.messages[0].id}`);
            }
            successCount++;
        } else {
            console.log('❌');
            console.error(`   Status: ${result.data?.error?.message || 'Unknown error'}`);
            console.error(`   Details: ${JSON.stringify(result.data || result.error)}`);
            failCount++;
        }

        await new Promise(r => setTimeout(r, 200));
    }

    console.log('\n' + '='.repeat(30));
    console.log('🏁 Broadcast Finished');
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed:  ${failCount}`);
    console.log('='.repeat(30) + '\n');
}

runBroadcast();
