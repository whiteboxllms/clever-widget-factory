#!/bin/bash
# Verify CloudFront Key Pair Configuration
# Checks that Key Pair ID is documented and private key is in Secrets Manager

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SPEC_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="$SPEC_DIR/cloudfront-config.env"

echo "=========================================="
echo "CloudFront Key Pair Verification"
echo "=========================================="
echo ""

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ Configuration file not found: $CONFIG_FILE"
    exit 1
fi

# Load configuration
source "$CONFIG_FILE"

echo "📋 Configuration loaded from: $CONFIG_FILE"
echo ""

# Verify Key Pair ID is set
if [ "$CLOUDFRONT_KEY_PAIR_ID" = "REPLACE_WITH_YOUR_KEY_PAIR_ID" ]; then
    echo "❌ Key Pair ID not configured"
    echo "   Run: ./scripts/setup-key-pair-id.sh <your-key-pair-id>"
    exit 1
fi

echo "✅ Key Pair ID: $CLOUDFRONT_KEY_PAIR_ID"
echo ""

# Verify Key Pair ID format
if [[ ! "$CLOUDFRONT_KEY_PAIR_ID" =~ ^APKA[A-Z0-9]+$ ]]; then
    echo "❌ Invalid Key Pair ID format"
    echo "   Expected: APKAXXXXXXXXXX"
    exit 1
fi

echo "✅ Key Pair ID format is valid"
echo ""

# Verify private key exists in Secrets Manager
echo "🔐 Verifying private key in Secrets Manager..."
echo ""

if aws secretsmanager describe-secret \
    --secret-id "$CLOUDFRONT_PRIVATE_KEY_SECRET_NAME" \
    --region "$AWS_REGION" \
    --output json > /dev/null 2>&1; then
    
    echo "✅ Private key found in Secrets Manager"
    
    # Get secret metadata
    SECRET_ARN=$(aws secretsmanager describe-secret \
        --secret-id "$CLOUDFRONT_PRIVATE_KEY_SECRET_NAME" \
        --region "$AWS_REGION" \
        --query 'ARN' \
        --output text)
    
    echo "   Secret Name: $CLOUDFRONT_PRIVATE_KEY_SECRET_NAME"
    echo "   Secret ARN: $SECRET_ARN"
    echo "   Region: $AWS_REGION"
    echo ""
    
    # Verify private key is valid RSA format
    echo "🔍 Verifying private key format..."
    if aws secretsmanager get-secret-value \
        --secret-id "$CLOUDFRONT_PRIVATE_KEY_SECRET_NAME" \
        --region "$AWS_REGION" \
        --query 'SecretString' \
        --output text | openssl rsa -check -noout 2>&1 | grep -q "RSA key ok"; then
        echo "✅ Private key is valid RSA format"
    else
        echo "❌ Private key validation failed"
        exit 1
    fi
else
    echo "❌ Private key not found in Secrets Manager"
    echo "   Expected secret: $CLOUDFRONT_PRIVATE_KEY_SECRET_NAME"
    echo "   Region: $AWS_REGION"
    exit 1
fi

echo ""
echo "=========================================="
echo "✅ All verifications passed!"
echo "=========================================="
echo ""
echo "Summary:"
echo "  • Key Pair ID: $CLOUDFRONT_KEY_PAIR_ID"
echo "  • Private Key: Stored in Secrets Manager"
echo "  • Configuration: $CONFIG_FILE"
echo ""
echo "Ready for Task 1.5: Verify key pair is active in CloudFront"
