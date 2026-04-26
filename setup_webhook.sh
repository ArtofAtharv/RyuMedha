#!/bin/bash

# Setup WhatsApp Webhook directory and file
echo "Creating function directory..."
sudo mkdir -p supabase/functions/whatsapp-webhook

echo "Copying code to function directory..."
sudo cp supabase/whatsapp-webhook-index.ts supabase/functions/whatsapp-webhook/index.ts

echo "Setting permissions..."
sudo chown -R $USER:$USER supabase/functions/whatsapp-webhook

echo "Done! You can now run: npx supabase functions deploy whatsapp-webhook --no-verify-jwt"
