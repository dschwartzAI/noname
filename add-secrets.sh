#!/bin/bash

# Add secrets from .dev.vars to Cloudflare Workers
# This script reads secrets from .dev.vars and adds them to Cloudflare

echo "🔐 Adding secrets to Cloudflare Workers..."
echo ""

if [ ! -f .dev.vars ]; then
  echo "❌ Error: .dev.vars file not found"
  exit 1
fi

# Read each line from .dev.vars
while IFS='=' read -r key value; do
  # Skip empty lines and comments
  if [[ -z "$key" ]] || [[ "$key" =~ ^# ]]; then
    continue
  fi
  
  # Trim whitespace
  key=$(echo "$key" | xargs)
  value=$(echo "$value" | xargs)
  
  if [[ -n "$key" ]] && [[ -n "$value" ]]; then
    echo "📝 Adding secret: $key"
    echo "$value" | npx wrangler secret put "$key"
    
    if [ $? -eq 0 ]; then
      echo "✅ Successfully added $key"
    else
      echo "❌ Failed to add $key"
    fi
    echo ""
  fi
done < .dev.vars

echo "🎉 Done! All secrets have been added."
echo ""
echo "💡 To verify secrets, run: npx wrangler secret list"

