#!/bin/bash
# Verify CloudFront Key Pair is Active
# Checks that the key pair exists and is enabled in CloudFront

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SPEC_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$SPEC_DIR/cloudfront-config.env"

echo "=========================================="
echo "CloudFront Key Pair Status Verification"
echo "=========================================="
echo ""

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Configuration file not found: $CONFIG_FILE"
    echo "   Run Task 1.4 first to document the Key Pair ID"
    exit 1
fi

# Load configuration
source "$CONFIG_FILE"

# Verify Key Pair ID is set
if [ "$CLOUDFRONT_KEY_PAIR_ID" = "REPLACE_WITH_YOUR_KEY_PAIR_ID" ]; then
    echo "❌ Key Pair ID not configured"
    echo "   Run: ./scripts/setup-key-pair-id.sh <your-key-pair-id>"
    exit 1
fi

echo "🔍 Checking Key Pair: $CLOUDFRONT_KEY_PAIR_ID"
echo ""

# Get key pair details from CloudFront
echo "📡 Fetching key pair details from CloudFront..."
echo ""

# Check if key pair exists
if ! aws cloudfront get-public-key \
    --id "$CLOUDFRONT_KEY_PAIR_ID" \
    --output json > /tmp/key-pair-details.json 2>&1; then
    
    echo "❌ Key pair not found in CloudFront"
    echo ""
    echo "Possible causes:"
    echo "  1. Key Pair ID is incorrect"
    echo "  2. Key pair was deleted"
    echo "  3. Insufficient IAM permissions"
    echo ""
    echo "Troubleshooting:"
    echo "  • Verify Key Pair ID in AWS Console → CloudFront → Key Management"
    echo "  • Check that you have cloudfront:GetPublicKey permission"
    echo "  • If key pair was deleted, repeat Tasks 1.1-1.4"
    exit 1
fi

# Extract key pair details
KEY_PAIR_ID=$(jq -r '.PublicKey.Id' /tmp/key-pair-details.json)
KEY_PAIR_CREATED=$(jq -r '.PublicKey.CreatedTime' /tmp/key-pair-details.json)
PUBLIC_KEY_ENCODED=$(jq -r '.PublicKey.PublicKeyConfig.EncodedKey' /tmp/key-pair-details.json)

echo "✅ Key Pair ID: $KEY_PAIR_ID"
echo "✅ Key Pair Created: $KEY_PAIR_CREATED"
echo ""

# Verify public key is present
if [ -z "$PUBLIC_KEY_ENCODED" ] || [ "$PUBLIC_KEY_ENCODED" = "null" ]; then
    echo "❌ Public key content is missing"
    echo "   This key pair may be corrupted"
    exit 1
fi

echo "✅ Public key is present ($(echo "$PUBLIC_KEY_ENCODED" | wc -c) bytes)"
echo ""

# Check if key pair is in the list of public keys (indicates it's active)
echo "🔍 Verifying key pair is active..."
echo ""

if aws cloudfront list-public-keys \
    --query "PublicKeyList.Items[?Id=='$CLOUDFRONT_KEY_PAIR_ID'].Id" \
    --output text | grep -q "$CLOUDFRONT_KEY_PAIR_ID"; then
    
    echo "✅ Key pair is active and listed in CloudFront"
else
    echo "❌ Key pair is not active or not listed"
    echo ""
    echo "Solution:"
    echo "  1. Go to AWS Console → CloudFront → Key Management"
    echo "  2. Find your key pair: $CLOUDFRONT_KEY_PAIR_ID"
    echo "  3. If status is 'Inactive', click Actions → Enable"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ Key pair is active and ready to use!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  • Key Pair ID: $KEY_PAIR_ID"
echo "  • Status: Active"
echo "  • Created: $KEY_PAIR_CREATED"
echo "  • Public Key: Present"
echo ""
echo "Next Steps:"
echo "  • Task 2: Create Origin Access Identity"
echo "  • Task 5: Create CloudFront distribution"
echo "  • Task 6: Create Cookie Generator Lambda"
echo ""
echo "How CloudFront will use this key pair:"
echo "  1. Lambda signs cookies with private key (from Secrets Manager)"
echo "  2. Lambda includes Key Pair ID in cookies"
echo "  3. CloudFront validates signatures using this public key"
echo "  4. If valid → serve image, if invalid → 403 Forbidden"

# Cleanup
rm -f /tmp/key-pair-details.json
