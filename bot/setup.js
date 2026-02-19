require('dotenv').config();

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;
const PIN = '270705'; // Your 6-digit PIN

async function registerNumber() {
    console.log('Registering phone number with Cloud API...');

    const response = await fetch(
        `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/register`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ACCESS_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                pin: PIN
            })
        }
    );

    const data = await response.json();

    if (data.success) {
        console.log('✅ Number registered successfully!');
        console.log('PIN:', PIN, '(save this!)');
    } else {
        console.error('❌ Registration failed:', data);
    }
}

registerNumber();