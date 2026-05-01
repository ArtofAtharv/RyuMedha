#!/bin/bash
echo "Updating bot and webhook processors..."
sudo cp supabase/processor_updated.ts supabase/functions/whatsapp-bot/processor.ts
sudo cp supabase/processor_webhook_updated.ts supabase/functions/whatsapp-webhook/processor.ts
echo "Processors updated successfully!"
echo ""
echo "To make the changes live, please run:"
echo "npx supabase functions deploy whatsapp-bot --no-verify-jwt"
echo "npx supabase functions deploy whatsapp-webhook --no-verify-jwt"
