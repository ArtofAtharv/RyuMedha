#!/bin/bash

# Configuration
API_URL="http://localhost:54321/functions/v1/whatsapp-bot"
PHONE="919876543210" # Use a test number
VERIFY_TOKEN="your_verify_token" # Change if needed

echo "🚀 Starting Onboarding Simulation..."

# 1. Start (needsOnboarding)
echo "Step 1: Sending 'hi' to start..."
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "'$PHONE'",
            "id": "wamid.'$(date +%s)'.1",
            "text": { "body": "hi" }
          }]
        }
      }]
    }]
  }'
echo -e "\n"

# 2. Provide Name
echo "Step 2: Providing name 'Atharv'..."
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "'$PHONE'",
            "id": "wamid.'$(date +%s)'.2",
            "text": { "body": "Atharv" }
          }]
        }
      }]
    }]
  }'
echo -e "\n"

# 3. Check Session Advance
echo "Step 3: Sending '1' for Setup Here..."
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "'$PHONE'",
            "id": "wamid.'$(date +%s)'.3",
            "text": { "body": "1" }
          }]
        }
      }]
    }]
  }'
echo -e "\n"
