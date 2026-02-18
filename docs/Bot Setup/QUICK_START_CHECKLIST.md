# 🚀 Quick Start Checklist

Use this checklist to track your setup progress.

## ✅ Prerequisites (Do This First)

- [ ] Node.js 18+ installed (`node --version`)
- [ ] Domain purchased (Hostinger or any provider)
- [ ] Cloudflare account created (free)
- [ ] Meta Developer account created

## ✅ Step 1: Domain Setup (30 minutes)

- [ ] Add domain to Cloudflare
- [ ] Get Cloudflare nameservers (ns1.cloudflare.com, ns2.cloudflare.com)
- [ ] Update nameservers in Hostinger domain settings
- [ ] Wait for DNS propagation (check status in Cloudflare)
- [ ] Verify Vercel website still works at main domain

**Current Status:** Domain on Cloudflare? _____ (Yes/No)

## ✅ Step 2: Install Cloudflare Tunnel (15 minutes)

**For Windows:**
```bash
winget install --id Cloudflare.cloudflared
```

**For macOS:**
```bash
brew install cloudflare/cloudflare/cloudflared
```

**For Linux:**
```bash
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

**Verify installation:**
```bash
cloudflared --version
```

- [ ] Cloudflared installed successfully
- [ ] Logged in with `cloudflared tunnel login`
- [ ] Created tunnel with `cloudflared tunnel create whatsapp-bot`
- [ ] Saved tunnel UUID: ___________________________

**Current Status:** Tunnel created? _____ (Yes/No)

## ✅ Step 3: Configure Tunnel (10 minutes)

- [ ] Created config.yml file at correct location
- [ ] Updated tunnel UUID in config.yml
- [ ] Updated credentials-file path in config.yml
- [ ] Updated hostname to your subdomain (bot.yourdomain.com)
- [ ] Validated config with `cloudflared tunnel ingress validate`
- [ ] Created DNS record with `cloudflared tunnel route dns whatsapp-bot bot.yourdomain.com`

**Config File Location:**
- Windows: `C:\Users\YourName\.cloudflared\config.yml`
- Mac: `/Users/youruser/.cloudflared/config.yml`
- Linux: `/home/youruser/.cloudflared/config.yml`

**Your Subdomain:** bot._____________________.com

## ✅ Step 4: Setup Webhook Server (10 minutes)

**In your project directory:**

```bash
# 1. Create project folder
mkdir whatsapp-bot
cd whatsapp-bot

# 2. Copy files
# - whatsapp-webhook-server.js
# - package.json
# - .env.example

# 3. Install dependencies
npm install

# 4. Create .env from template
cp .env.example .env

# 5. Generate webhook verification token
# Linux/Mac:
openssl rand -hex 32
# Windows: Just create a random 64-character string
```

**Edit .env file:**
- [ ] Set PORT=3000
- [ ] Set WEBHOOK_VERIFY_TOKEN (save this - you'll need it in Meta)
- [ ] Set WHATSAPP_TOKEN (get from Meta later)
- [ ] Set WHATSAPP_PHONE_NUMBER_ID (get from Meta later)

**Your Verification Token:** ___________________________

## ✅ Step 5: Test Tunnel + Server (5 minutes)

**Terminal 1 - Start webhook server:**
```bash
npm start
```

**Terminal 2 - Start Cloudflare tunnel:**
```bash
cloudflared tunnel run whatsapp-bot
```

**Test in browser:**
- [ ] Visit https://bot.yourdomain.com
- [ ] Should see: `{"status":"running","service":"WhatsApp Bot Webhook Server",...}`

**Test webhook verification:**
```bash
curl "https://bot.yourdomain.com/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=test123"
```

- [ ] Returns: `test123`

**Current Status:** Tunnel + Server working? _____ (Yes/No)

## ✅ Step 6: Create Meta WhatsApp App (15 minutes)

Go to: https://developers.facebook.com/apps

- [ ] Clicked "Create App"
- [ ] Selected "Business" type
- [ ] Named app: _____________________
- [ ] Created app successfully
- [ ] Added "WhatsApp" product
- [ ] Saw test phone number provided

**Your App ID:** ___________________________

## ✅ Step 7: Get WhatsApp API Credentials (5 minutes)

In Meta App → WhatsApp → API Setup:

- [ ] Copied Temporary Access Token
- [ ] Copied Phone Number ID
- [ ] Updated .env file with these values
- [ ] Restarted webhook server (`npm start`)

**Temporary Token:** EAAG... (first 10 chars) ___________________________
**Phone Number ID:** ___________________________

## ✅ Step 8: Configure Webhook in Meta (10 minutes)

In Meta App → WhatsApp → Configuration → Webhooks:

- [ ] Clicked "Configure Webhooks"
- [ ] Entered Callback URL: https://bot.yourdomain.com/webhook
- [ ] Entered Verify Token: (same as WEBHOOK_VERIFY_TOKEN in .env)
- [ ] Clicked "Verify and Save"
- [ ] Saw ✅ "Webhook verified" success message
- [ ] Subscribed to "messages" field
- [ ] Subscribed to "message_status" field (optional)

**Current Status:** Webhook verified in Meta? _____ (Yes/No)

## ✅ Step 9: Test with Your Phone (10 minutes)

In Meta App → WhatsApp → API Setup:

- [ ] Clicked "Send message" or "Manage phone number list"
- [ ] Added your personal WhatsApp number
- [ ] Verified with code sent to WhatsApp
- [ ] Your number appears in test list

**Send test from Meta:**
- [ ] Clicked "Send message" button
- [ ] Selected your number
- [ ] Sent test message
- [ ] Checked webhook server terminal - saw message received

**Send test from your phone:**
- [ ] Opened WhatsApp
- [ ] Started chat with test number
- [ ] Sent "hi"
- [ ] Bot responded with welcome message

**Current Status:** End-to-end working? _____ (Yes/No)

## ✅ Step 10: Production Setup (Optional - For Mini-PC)

**Install PM2:**
```bash
npm install -g pm2
```

**Start server with PM2:**
```bash
pm2 start whatsapp-webhook-server.js --name whatsapp-bot
pm2 save
pm2 startup
```

**Install Cloudflare tunnel as service:**

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

- [ ] PM2 installed and server running
- [ ] Cloudflared running as service
- [ ] Both auto-start on system restart
- [ ] Tested restart - everything comes back up

## 🎉 Success Checklist

You're done when all of these work:

- [ ] ✅ Tunnel is running and accessible
- [ ] ✅ Webhook server is running
- [ ] ✅ Meta webhook is verified
- [ ] ✅ Can send message from WhatsApp → Bot receives it
- [ ] ✅ Bot can send response back

## 📊 Current Status

**Overall Progress:** _____% complete

**Next Steps:**
1. ___________________________________________
2. ___________________________________________
3. ___________________________________________

## 🆘 Troubleshooting

**If webhook verification fails:**
- Check WEBHOOK_VERIFY_TOKEN matches in .env and Meta dashboard
- Verify server is running: `curl https://bot.yourdomain.com`
- Check server logs for errors

**If messages not received:**
- Verify webhook subscribed to "messages" field
- Check test number is in allowed list
- Look at server terminal - any incoming requests?

**If can't send messages:**
- Verify WHATSAPP_TOKEN is correct and not expired
- Check WHATSAPP_PHONE_NUMBER_ID is correct
- Ensure recipient in test number list

**If tunnel not working:**
```bash
cloudflared tunnel list
cloudflared tunnel ingress validate
```

## 📝 Important Notes

**Temporary Token Expires:**
- The temporary access token expires every 24 hours
- For production, generate a permanent System User token
- Instructions: https://developers.facebook.com/docs/whatsapp/business-management-api/get-started

**Test Number Limit:**
- Free tier: 5 test numbers
- For production: Submit app for review to remove limit

**Rate Limits:**
- Test mode: 250 messages/day
- Production: 1000 messages/day (Quality: Green)

---

**Setup Date:** _____________________
**Completed By:** _____________________
**Working:** _____ (Yes/No)
