// whatsapp-webhook-server.js
// Simple WhatsApp webhook server for development

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Logger middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// ============================================================================
// WEBHOOK VERIFICATION (GET /webhook)
// ============================================================================

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('📋 Webhook Verification Request:');
  console.log('  Mode:', mode);
  console.log('  Token:', token);
  console.log('  Challenge:', challenge);

  if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
    console.log('✅ WEBHOOK VERIFIED SUCCESSFULLY');
    res.status(200).send(challenge);
  } else {
    console.log('❌ WEBHOOK VERIFICATION FAILED');
    console.log('  Expected token:', WEBHOOK_VERIFY_TOKEN);
    console.log('  Received token:', token);
    res.sendStatus(403);
  }
});

// ============================================================================
// WEBHOOK ENDPOINT (POST /webhook)
// ============================================================================

app.post('/webhook', async (req, res) => {
  console.log('\n📩 Incoming Webhook Event:');
  console.log(JSON.stringify(req.body, null, 2));

  try {
    // Parse webhook body
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;
    const statuses = value?.statuses;

    // Handle message events
    if (messages && messages.length > 0) {
      for (const message of messages) {
        await handleIncomingMessage(message, value);
      }
    }

    // Handle status updates (delivery, read, etc.)
    if (statuses && statuses.length > 0) {
      for (const status of statuses) {
        handleStatusUpdate(status);
      }
    }

    // Always respond 200 to acknowledge receipt
    res.status(200).send('EVENT_RECEIVED');

  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    res.status(500).send('ERROR');
  }
});

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

async function handleIncomingMessage(message, value) {
  const from = message.from; // Phone number (e.g., "919876543210")
  const messageId = message.id;
  const timestamp = message.timestamp;
  const messageType = message.type; // text, image, document, etc.

  console.log('\n📱 New Message:');
  console.log('  From:', from);
  console.log('  Type:', messageType);
  console.log('  ID:', messageId);

  // Handle different message types
  if (messageType === 'text') {
    const text = message.text?.body;
    console.log('  Text:', text);
    
    // Process text message
    await processTextMessage(from, text, messageId);
    
  } else if (messageType === 'image') {
    console.log('  Image received (not implemented yet)');
    
  } else if (messageType === 'document') {
    console.log('  Document received (not implemented yet)');
    
  } else {
    console.log('  Unsupported message type:', messageType);
  }
}

// ============================================================================
// TEXT MESSAGE PROCESSING
// ============================================================================

async function processTextMessage(from, text, messageId) {
  console.log('\n🔄 Processing message...');

  // Simple command parsing
  const lowerText = text.toLowerCase().trim();

  try {
    let response = '';

    // Command: hi, hello
    if (lowerText === 'hi' || lowerText === 'hello') {
      response = "👋 Hey! Welcome to SadhyaSmriti!\n\n" +
                "I can help you track:\n" +
                "• Attendance\n" +
                "• Tasks\n" +
                "• Study time\n\n" +
                "Try saying: 'attended DS today'";
    }
    
    // Command: help
    else if (lowerText === 'help') {
      response = "📚 Available Commands:\n\n" +
                "• 'hi' - Get started\n" +
                "• 'attended <subject>' - Mark attendance\n" +
                "• 'stats' - View your statistics\n" +
                "• 'help' - Show this message";
    }
    
    // Command: stats
    else if (lowerText === 'stats') {
      response = "📊 Your Stats:\n\n" +
                "This feature is coming soon!\n" +
                "We're working on connecting to the database.";
    }
    
    // Command: attended <subject>
    else if (lowerText.includes('attended')) {
      // Extract subject name
      const subject = text.replace(/attended/i, '').trim();
      
      response = `✅ Marked attendance for ${subject}!\n\n` +
                "Database integration coming soon...";
    }
    
    // Default response
    else {
      response = "I didn't understand that. 🤔\n\n" +
                "Try saying 'help' to see what I can do!";
    }

    // Send response
    await sendWhatsAppMessage(from, response);

  } catch (error) {
    console.error('❌ Error processing message:', error);
    await sendWhatsAppMessage(from, "Sorry, something went wrong. Please try again.");
  }
}

// ============================================================================
// STATUS UPDATE HANDLING
// ============================================================================

function handleStatusUpdate(status) {
  console.log('\n📬 Status Update:');
  console.log('  ID:', status.id);
  console.log('  Status:', status.status); // sent, delivered, read, failed
  console.log('  Timestamp:', status.timestamp);
  
  // You can log delivery confirmations here
}

// ============================================================================
// SEND WHATSAPP MESSAGE
// ============================================================================

async function sendWhatsAppMessage(to, message) {
  const url = `https://graph.facebook.com/v18.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
  
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: to,
    type: 'text',
    text: {
      preview_url: false,
      body: message
    }
  };

  console.log('\n📤 Sending message to', to);
  console.log('  Message:', message.substring(0, 50) + '...');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ WhatsApp API Error:', error);
      throw new Error(JSON.stringify(error));
    }

    const data = await response.json();
    console.log('✅ Message sent successfully');
    console.log('  Message ID:', data.messages?.[0]?.id);
    
    return data;
    
  } catch (error) {
    console.error('❌ Error sending message:', error);
    throw error;
  }
}

// ============================================================================
// HEALTH CHECK & ROOT ENDPOINTS
// ============================================================================

app.get('/', (req, res) => {
  res.json({
    status: 'running',
    service: 'WhatsApp Bot Webhook Server',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      webhook: '/webhook (GET for verification, POST for events)'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 WhatsApp Webhook Server Started');
  console.log('='.repeat(60));
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`🌍 Public: https://bot.yourdomain.com (via Cloudflare Tunnel)`);
  console.log(`📡 Webhook: https://bot.yourdomain.com/webhook`);
  console.log('='.repeat(60));
  console.log('\n✅ Server is ready to receive webhooks!');
  console.log('📋 Make sure to:');
  console.log('   1. Cloudflare tunnel is running');
  console.log('   2. Webhook is configured in Meta dashboard');
  console.log('   3. .env file has correct tokens\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n👋 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\n👋 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});
