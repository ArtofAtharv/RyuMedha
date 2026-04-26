#!/bin/bash

# Setup WhatsApp Webhook directory and file
echo "Creating function directory..."
sudo mkdir -p supabase/functions/whatsapp-webhook

echo "Copying code to function directory..."
sudo cp supabase/whatsapp-webhook-index.ts supabase/functions/whatsapp-webhook/index.ts

echo "Setting up engagement function..."
sudo mkdir -p supabase/functions/whatsapp-engagement
sudo cp supabase/whatsapp-engagement-index.ts supabase/functions/whatsapp-engagement/index.ts
sudo chown -R $USER:$USER supabase/functions/whatsapp-engagement

echo "Done! You can now run:"
echo "npx supabase functions deploy whatsapp-webhook --no-verify-jwt"
echo "npx supabase functions deploy whatsapp-engagement --no-verify-jwt"
