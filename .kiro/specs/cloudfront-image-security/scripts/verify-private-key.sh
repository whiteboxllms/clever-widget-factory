#!/bin/bash

# CloudFront Private Key Verification Script
# Task 1.2: Download private key PEM file
# 
# This script verifies that the CloudFront private key is properly formatted
# and securely stored.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default key path
KEY_PATH="${1:-.keys/cloudfront-private-key.pem}"

echo "=========================================="
echo "CloudFront Private Key Verification"
echo "=========================================="
echo ""

# Check if key file exists
echo -n "1. Checking if key file exists... "
if [ ! -f "$KEY_PATH" ]; then
    echo -e "${RED}FAIL${NC}"
    echo ""
    echo "Private key not found at: $KEY_PATH"
    echo ""
    echo "Please ensure you have:"
    echo "  1. Generated the CloudFront key pair in AWS Console (Task 1.1)"
    echo "  2. Downloaded the private_key.pem file"
    echo "  3. Moved it to .keys/cloudfront-private-key.pem"
    echo ""
    echo "Usage: $0 [path-to-private-key.pem]"
    exit 1
fi
echo -e "${GREEN}PASS${NC}"

# Check file permissions
echo -n "2. Checking file permissions... "
PERMS=$(stat -f "%Lp" "$KEY_PATH" 2>/dev/null || stat -c "%a" "$KEY_PATH" 2>/dev/null)
if [ "$PERMS" != "600" ]; then
    echo -e "${YELLOW}WARN${NC}"
    echo "   Current permissions: $PERMS (should be 600)"
    echo "   Fixing permissions..."
    chmod 600 "$KEY_PATH"
    echo -e "   ${GREEN}Fixed${NC}"
else
    echo -e "${GREEN}PASS${NC}"
fi

# Check file format (PEM headers)
echo -n "3. Checking PEM format... "
if ! head -1 "$KEY_PATH" | grep -q "BEGIN RSA PRIVATE KEY"; then
    echo -e "${RED}FAIL${NC}"
    echo "   File does not start with '-----BEGIN RSA PRIVATE KEY-----'"
    echo "   This may not be a valid PEM-formatted RSA private key."
    exit 1
fi

if ! tail -1 "$KEY_PATH" | grep -q "END RSA PRIVATE KEY"; then
    echo -e "${RED}FAIL${NC}"
    echo "   File does not end with '-----END RSA PRIVATE KEY-----'"
    echo "   This may not be a valid PEM-formatted RSA private key."
    exit 1
fi
echo -e "${GREEN}PASS${NC}"

# Check file size (RSA 2048-bit keys are typically 1600-1700 bytes)
echo -n "4. Checking file size... "
FILE_SIZE=$(wc -c < "$KEY_PATH" | tr -d ' ')
if [ "$FILE_SIZE" -lt 1000 ] || [ "$FILE_SIZE" -gt 3000 ]; then
    echo -e "${YELLOW}WARN${NC}"
    echo "   File size: $FILE_SIZE bytes (expected 1600-1700 for RSA 2048-bit)"
    echo "   This may indicate an incomplete or corrupted key file."
else
    echo -e "${GREEN}PASS${NC} ($FILE_SIZE bytes)"
fi

# Verify key integrity with OpenSSL
echo -n "5. Verifying RSA key integrity... "
if ! openssl rsa -in "$KEY_PATH" -check -noout 2>/dev/null; then
    echo -e "${RED}FAIL${NC}"
    echo "   OpenSSL reports the key is invalid or corrupted."
    echo "   You may need to regenerate the key pair in AWS Console."
    exit 1
fi
echo -e "${GREEN}PASS${NC}"

# Extract key information
echo -n "6. Extracting key information... "
KEY_SIZE=$(openssl rsa -in "$KEY_PATH" -text -noout 2>/dev/null | grep "Private-Key:" | grep -o "[0-9]*")
echo -e "${GREEN}PASS${NC}"
echo "   Key size: $KEY_SIZE bits"

# Check if key is in .gitignore
echo -n "7. Checking .gitignore protection... "
if [ -f ".gitignore" ]; then
    if grep -q "\.keys" .gitignore || grep -q "cloudfront-private-key.pem" .gitignore; then
        echo -e "${GREEN}PASS${NC}"
    else
        echo -e "${YELLOW}WARN${NC}"
        echo "   .keys/ directory not found in .gitignore"
        echo "   Adding to .gitignore..."
        echo ".keys/" >> .gitignore
        echo -e "   ${GREEN}Added${NC}"
    fi
else
    echo -e "${YELLOW}WARN${NC}"
    echo "   .gitignore not found in current directory"
fi

# Check if key is tracked by git
echo -n "8. Checking git tracking... "
if git ls-files --error-unmatch "$KEY_PATH" 2>/dev/null; then
    echo -e "${RED}FAIL${NC}"
    echo "   ${RED}WARNING: Private key is tracked by git!${NC}"
    echo "   This is a SECURITY RISK. Remove it immediately:"
    echo "   git rm --cached $KEY_PATH"
    echo "   git commit -m 'Remove private key from git'"
else
    echo -e "${GREEN}PASS${NC}"
fi

# Extract public key for verification
echo -n "9. Extracting public key... "
PUBLIC_KEY_PATH="${KEY_PATH%.pem}-public.pem"
if openssl rsa -in "$KEY_PATH" -pubout -out "$PUBLIC_KEY_PATH" 2>/dev/null; then
    echo -e "${GREEN}PASS${NC}"
    echo "   Public key saved to: $PUBLIC_KEY_PATH"
    echo "   You can compare this with the public key in AWS CloudFront Console"
else
    echo -e "${RED}FAIL${NC}"
    echo "   Could not extract public key"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}Verification Complete!${NC}"
echo "=========================================="
echo ""
echo "Next steps:"
echo "  1. Compare the public key with AWS CloudFront Console"
echo "  2. Note your CloudFront Key Pair ID (format: APKAXXXXXXXXXX)"
echo "  3. Proceed to Task 1.3: Store private key in AWS Secrets Manager"
echo ""
echo "Key location: $KEY_PATH"
echo "Public key: $PUBLIC_KEY_PATH"
echo ""
