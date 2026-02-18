# Complete WhatsApp Webhook Setup with Cloudflare Tunnel

## 📋 What You'll Build

```
WhatsApp Cloud API
       ↓ (webhook events)
bot.yourdomain.com (Cloudflare Tunnel)
       ↓
Your Laptop/Mini-PC (Node.js webhook server)
       ↓
Process message → Query Supabase → Respond
```

---

## PART 1: Install Cloudflare Tunnel (Cloudflared)

### **Step 1: Install Cloudflared on Your System**

**For Windows:**
```powershell
# Download the installer
# Visit: https://github.com/cloudflare/cloudflared/releases
# Download: cloudflared-windows-amd64.exe
# Rename to: cloudflared.exe
# Move to: C:\Windows\System32\cloudflared.exe

# Or use winget:
winget install --id Cloudflare.cloudflared
```

**For macOS:**
```bash
# Using Homebrew
brew install cloudflare/cloudflare/cloudflared
```

**For Linux (Ubuntu/Debian):**
```bash
# Download latest release
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb

# Install
sudo dpkg -i cloudflared-linux-amd64.deb

# Verify installation
cloudflared --version
```

### **Step 2: Authenticate Cloudflared**

```bash
# This will open a browser window for login
cloudflared tunnel login

# Login with your Cloudflare account
# (Create one at cloudflare.com if you don't have it)
```

This creates a certificate file at:
- Windows: `C:\Users\YourName\.cloudflared\cert.pem`
- Mac/Linux: `~/.cloudflared/cert.pem`

---

## PART 2: Add Domain to Cloudflare

Since your domain is on Hostinger, we need to move DNS to Cloudflare:

### **Step 1: Add Site to Cloudflare**

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Click **"Add a Site"**
3. Enter your domain: `yourdomain.com`
4. Choose **Free Plan**
5. Click **"Add Site"**

### **Step 2: Update Nameservers at Hostinger**

Cloudflare will show you 2 nameservers like:
```
ns1.cloudflare.com
ns2.cloudflare.com
```

Now go to Hostinger:

1. Login to Hostinger
2. Go to **Domains** → Select your domain
3. Find **Nameservers** section
4. Change from Hostinger nameservers to Cloudflare nameservers:
   ```
   ns1.cloudflare.com
   ns2.cloudflare.com
   ```
5. Save changes

**⏰ Wait 5-60 minutes for DNS propagation**

### **Step 3: Verify in Cloudflare**

Back in Cloudflare dashboard:
- Wait for status to change from "Pending" to "Active"
- You'll get an email when it's complete

### **Step 4: Keep Vercel Working**

Important! Your website is on Vercel, so we need to preserve that:

In Cloudflare Dashboard → DNS → Records:

1. Find the existing A or CNAME record pointing to Vercel
2. Make sure it looks like this:
   ```
   Type: CNAME
   Name: @ (or your domain)
   Target: cname.vercel-dns.com (or your Vercel URL)
   Proxy Status: ON (orange cloud)
   ```

This keeps your main website working on Vercel! ✅

---

## PART 3: Create Cloudflare Tunnel

### **Step 1: Create a Tunnel**

```bash
# Create tunnel named "whatsapp-bot"
cloudflared tunnel create whatsapp-bot
```

Output will show:
```
Tunnel credentials written to: ~/.cloudflared/UUID.json
Created tunnel whatsapp-bot with id UUID
```

**Save the UUID** — you'll need it!

### **Step 2: Create Config File**

Create config file for the tunnel:

**Windows:** `C:\Users\YourName\.cloudflared\config.yml`
**Mac/Linux:** `~/.cloudflared/config.yml`

```yaml
# Replace UUID with your actual tunnel ID
tunnel: YOUR-TUNNEL-UUID
credentials-file: /home/youruser/.cloudflared/YOUR-TUNNEL-UUID.json

ingress:
  # This routes bot.yourdomain.com to your local server
  - hostname: bot.yourdomain.com
    service: http://localhost:3000
  
  # Catch-all rule (required)
  - service: http_status:404
```

**Important:** 
- Replace `YOUR-TUNNEL-UUID` with the actual UUID from Step 1
- Replace `bot.yourdomain.com` with your actual subdomain
- Replace `/home/youruser/` with your actual path (Windows: `C:\Users\YourName\`)

### **Step 3: Add DNS Record in Cloudflare**

```bash
# This creates the subdomain automatically
cloudflared tunnel route dns whatsapp-bot bot.yourdomain.com
```

Replace `whatsapp-bot` with your tunnel name and `bot.yourdomain.com` with your subdomain.

This creates a DNS record in Cloudflare pointing `bot.yourdomain.com` to your tunnel.

### **Step 4: Test the Tunnel**

```bash
# Run the tunnel
cloudflared tunnel run whatsapp-bot
```

You should see:
```
INF Connection established
INF Registered tunnel connection
```

**Keep this terminal open!** The tunnel is now running.

---

## PART 4: Create Webhook Server (Node.js)

Now let's create the actual webhook server that will receive WhatsApp messages.

### **Step 1: Create Project Directory**

```bash
mkdir whatsapp-bot
cd whatsapp-bot
npm init -y
```

### **Step 2: Install Dependencies**

```bash
npm install express body-parser dotenv
```

### **Step 3: Create Webhook Server**

Create `server.js`:

```javascript
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;

// WhatsApp webhook verification token (you'll set this)
const WEBHOOK_VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'your_secret_token';

// Middleware
app.use(bodyParser.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.send('WhatsApp Bot Server is running! ✅');
});

// Webhook verification (WhatsApp will call this)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('Verification request:', { mode, token, challenge });

  if (mode === 'subscribe' && token === WEBHOOK_VERIFY_TOKEN) {
    console.log('✅ Webhook verified!');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Verification failed!');
    res.sendStatus(403);
  }
});

// Webhook endpoint (receives messages from WhatsApp)
app.post('/webhook', (req, res) => {
  console.log('📩 Webhook received:', JSON.stringify(req.body, null, 2));

  try {
    // Extract message data
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (messages && messages.length > 0) {
      const message = messages[0];
      const from = message.from; // Phone number
      const messageBody = message.text?.body; // Message text
      const messageId = message.id;

      console.log(`📱 Message from ${from}: ${messageBody}`);

      // TODO: Process message here
      // - Parse command
      // - Query Supabase
      // - Send response via WhatsApp API

      // For now, just acknowledge receipt
      res.status(200).send('EVENT_RECEIVED');
    } else {
      // Not a message event, just acknowledge
      res.status(200).send('EVENT_RECEIVED');
    }
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    res.status(500).send('ERROR');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Webhook server running on http://localhost:${PORT}`);
  console.log(`🌍 Public URL: https://bot.yourdomain.com`);
  console.log(`📡 Webhook URL: https://bot.yourdomain.com/webhook`);
});
```

### **Step 4: Create .env File**

Create `.env`:

```env
# Webhook verification token (make this secret and random)
WEBHOOK_VERIFY_TOKEN=your_super_secret_token_12345

# WhatsApp API credentials (you'll get these later)
WHATSAPP_TOKEN=your_whatsapp_api_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
```

### **Step 5: Test Locally**

```bash
# Terminal 1: Run the server
node server.js

# Terminal 2: Run the Cloudflare tunnel
cloudflared tunnel run whatsapp-bot
```

Now test:
```bash
# Should show: WhatsApp Bot Server is running!
curl https://bot.yourdomain.com

# Should trigger webhook verification
curl "https://bot.yourdomain.com/webhook?hub.mode=subscribe&hub.verify_token=your_super_secret_token_12345&hub.challenge=test123"
```

If verification works, you'll see `test123` returned! ✅

---

## PART 5: Configure WhatsApp Cloud API

### **Step 1: Create Meta App**

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Click **"My Apps"** → **"Create App"**
3. Choose **"Business"** type
4. Fill in app details:
   - App Name: `SadhyaSmriti Bot` (or your name)
   - Contact Email: your email
5. Click **"Create App"**

### **Step 2: Add WhatsApp Product**

1. In your app dashboard, find **"WhatsApp"**
2. Click **"Set Up"**
3. You'll see a test phone number provided by Meta

### **Step 3: Get API Credentials**

In WhatsApp → API Setup, you'll see:

```
Temporary Access Token: EAAG... (copy this)
Phone Number ID: 123456789 (copy this)
WhatsApp Business Account ID: 123456789
```

**Update your .env file:**

```env
WEBHOOK_VERIFY_TOKEN=your_super_secret_token_12345
WHATSAPP_TOKEN=EAAG... (paste the temporary token)
WHATSAPP_PHONE_NUMBER_ID=123456789 (paste phone number ID)
```

### **Step 4: Configure Webhook in Meta**

Still in WhatsApp → Configuration:

1. Click **"Configure Webhooks"**
2. Click **"Edit"**
3. Enter:
   ```
   Callback URL: https://bot.yourdomain.com/webhook
   Verify Token: your_super_secret_token_12345
   ```
   (Must match WEBHOOK_VERIFY_TOKEN in your .env)
4. Click **"Verify and Save"**

If successful, you'll see: ✅ **"Webhook verified"**

### **Step 5: Subscribe to Webhook Fields**

Still in webhook configuration, subscribe to:
- ✅ messages
- ✅ message_status (optional, for delivery tracking)

Click **"Save"**

---

## PART 6: Test End-to-End

### **Step 1: Add Your Number to Test**

In WhatsApp → API Setup:
1. Find **"To"** field
2. Click **"Manage phone number list"**
3. Add your personal WhatsApp number
4. Verify with the code sent to WhatsApp

### **Step 2: Send Test Message**

In WhatsApp → API Setup:
1. Click **"Send message"** button
2. Select your number from the list
3. Send a test message

### **Step 3: Check Your Terminal**

In your Node.js server terminal, you should see:
```
📩 Webhook received: {
  "entry": [...],
  "messages": [...]
}
📱 Message from 919876543210: Hello!
```

**🎉 It works! Your webhook is receiving messages!**

---

## PART 7: Send Response Back

Now let's make the bot respond. Update `server.js`:

```javascript
// ... previous code ...

// Add this function to send messages
async function sendWhatsAppMessage(to, message) {
  const url = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  
  const payload = {
    messaging_product: 'whatsapp',
    to: to,
    text: { body: message }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('✅ Message sent:', data);
    return data;
  } catch (error) {
    console.error('❌ Error sending message:', error);
    throw error;
  }
}

// Update the webhook POST handler
app.post('/webhook', async (req, res) => {
  console.log('📩 Webhook received:', JSON.stringify(req.body, null, 2));

  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (messages && messages.length > 0) {
      const message = messages[0];
      const from = message.from;
      const messageBody = message.text?.body;

      console.log(`📱 Message from ${from}: ${messageBody}`);

      // Simple echo bot for now
      await sendWhatsAppMessage(from, `You said: ${messageBody}`);

      res.status(200).send('EVENT_RECEIVED');
    } else {
      res.status(200).send('EVENT_RECEIVED');
    }
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    res.status(500).send('ERROR');
  }
});
```

**Restart your server and test!**

Send "Hello" to the test number → Bot should reply "You said: Hello" ✅

---

## PART 8: Running in Production

### **Option 1: Keep Laptop Running (Development)**

Just keep both processes running:
```bash
# Terminal 1
node server.js

# Terminal 2
cloudflared tunnel run whatsapp-bot
```

### **Option 2: Run as Service (Mini-PC)**

**Install PM2 (Process Manager):**
```bash
npm install -g pm2
```

**Start server with PM2:**
```bash
pm2 start server.js --name whatsapp-bot
pm2 save
pm2 startup
```

**Install Cloudflared as Service:**

**Linux:**
```bash
sudo cloudflared service install
sudo systemctl start cloudflared
sudo systemctl enable cloudflared
```

**Windows:**
```powershell
cloudflared service install
```

Now everything runs automatically, even after restart! ✅

---

## 🎯 Summary: What You've Built

```
1. Domain DNS → Cloudflare (nameservers)
2. Website (yourdomain.com) → Still on Vercel ✅
3. Subdomain (bot.yourdomain.com) → Cloudflare Tunnel → Your Machine
4. Node.js webhook server running on localhost:3000
5. WhatsApp Cloud API → Sends events to bot.yourdomain.com/webhook
6. Server processes messages → Can respond back to WhatsApp
```

---

## 📋 Quick Troubleshooting

**Problem: Tunnel not connecting**
```bash
# Check tunnel status
cloudflared tunnel list

# Check config file syntax
cloudflared tunnel ingress validate
```

**Problem: Webhook verification fails**
- Verify WEBHOOK_VERIFY_TOKEN matches in both .env and Meta dashboard
- Check server is running: `curl https://bot.yourdomain.com`
- Check server logs for errors

**Problem: Messages not received**
- Check webhook is subscribed to "messages" field
- Verify your test number is added to allowed list
- Check server terminal for incoming requests

**Problem: Can't send messages**
- Verify WHATSAPP_TOKEN is correct
- Check WHATSAPP_PHONE_NUMBER_ID is correct
- Make sure recipient number is in test list

---

## 🚀 Next Steps

1. ✅ Webhook is working
2. ✅ Bot can receive and send messages
3. 🔜 Connect to Supabase (your database)
4. 🔜 Parse user commands ("attended DS today")
5. 🔜 Generate user-scoped JWTs
6. 🔜 Insert data into database
7. 🔜 Send intelligent responses

Ready to integrate Supabase? Let me know and I'll create the full integration code!
