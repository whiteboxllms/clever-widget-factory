#!/bin/bash
# Setup CloudFront Key Pair ID Configuration
# Task 1.4: Note the CloudFront Key Pair ID for Lambda configuration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SPEC_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$SPEC_DIR/cloudfront-config.env"

echo "=========================================="
echo "CloudFront Key Pair ID Setup"
echo "=========================================="
echo ""

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Error: Configuration file not found: $CONFIG_FILE"
    exit 1
fi

echo "📋 Current configuration:"
echo ""
grep "CLOUDFRONT_KEY_PAIR_ID" "$CONFIG_FILE"
echo ""

# Check if Key Pair ID is already set
CURRENT_ID=$(grep "^CLOUDFRONT_KEY_PAIR_ID=" "$CONFIG_FILE" | cut -d'=' -f2)

if [ "$CURRENT_ID" != "REPLACE_WITH_YOUR_KEY_PAIR_ID" ]; then
    echo "✅ Key Pair ID is already configured: $CURRENT_ID"
    echo ""
    echo "To update it, run:"
    echo "  ./scripts/setup-key-pair-id.sh <new-key-pair-id>"
    exit 0
fi

# Prompt for Key Pair ID
echo "🔑 Please enter your CloudFront Key Pair ID"
echo "   (Format: APKAXXXXXXXXXX)"
echo ""

# Check if Key Pair ID provided as argument
if [ -n "$1" ]; then
    KEY_PAIR_ID="$1"
else
    read -p "Key Pair ID: " KEY_PAIR_ID
fi

# Validate format
if [[ ! "$KEY_PAIR_ID" =~ ^APKA[A-Z0-9]+$ ]]; then
    echo ""
    echo "❌ Error: Invalid Key Pair ID format"
    echo "   Expected format: APKAXXXXXXXXXX (starts with 'APKA')"
    echo "   You entered: $KEY_PAIR_ID"
    exit 1
fi

echo ""
echo "✅ Valid Key Pair ID format: $KEY_PAIR_ID"
echo ""

# Update configuration file
echo "📝 Updating configuration file..."
sed -i.bak "s/CLOUDFRONT_KEY_PAIR_ID=.*/CLOUDFRONT_KEY_PAIR_ID=$KEY_PAIR_ID/" "$CONFIG_FILE"

# Verify update
UPDATED_ID=$(grep "^CLOUDFRONT_KEY_PAIR_ID=" "$CONFIG_FILE" | cut -d'=' -f2)

if [ "$UPDATED_ID" = "$KEY_PAIR_ID" ]; then
    echo "✅ Configuration updated successfully!"
    echo ""
    echo "📄 Configuration file: $CONFIG_FILE"
    echo "🔑 Key Pair ID: $UPDATED_ID"
    echo ""
    echo "Next steps:"
    echo "  1. Verify key pair is active: ./scripts/verify-key-pair.sh"
    echo "  2. Proceed to Task 1.5"
else
    echo "❌ Error: Failed to update configuration file"
    exit 1
fi
